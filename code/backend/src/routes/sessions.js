const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generate3QrSequence } = require('../services/qrTokenService');
const { isEnrolled } = require('../utils/access');

const router = express.Router();

// POST /sessions — Teacher starts a new live attendance session
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { classroom_id } = req.body;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id is required' });
    }

    // Verify teacher owns this classroom
    const classroomCheck = await db.query(
      `SELECT c.*, co.course_code, co.course_name
       FROM classrooms c
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = $1`,
      [classroom_id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroomCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    // Idempotency: if this classroom already has a live session (e.g. a
    // previous attempt reported an error after the row was inserted), reuse it
    // instead of stacking duplicate "never ended" sessions.
    const existingActive = await db.query(
      `SELECT * FROM sessions
       WHERE classroom_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [classroom_id]
    );

    if (existingActive.rows.length > 0) {
      return res.status(200).json({
        message: 'An attendance session is already active for this classroom',
        already_active: true,
        session: {
          ...existingActive.rows[0],
          course_code: classroomCheck.rows[0].course_code,
          course_name: classroomCheck.rows[0].course_name,
          section_name: classroomCheck.rows[0].section_name,
        },
        initial_tokens: null,
      });
    }

    // Create session in database
    const sessionResult = await db.query(
      `INSERT INTO sessions (classroom_id, started_at)
       VALUES ($1, now())
       RETURNING *`,
      [classroom_id]
    );

    const session = sessionResult.rows[0];

    // Pre-generate the first batch of 3-QR tokens.
    // Token generation is a cache operation: if it fails the session is still
    // live and the projector will retry, so it must never fail the request
    // (which previously reported "failed" while a session had been created).
    let tokenBatch = null;
    try {
      tokenBatch = await generate3QrSequence(session.id);
    } catch (tokenErr) {
      console.error('Session created but initial QR token batch generation failed:', tokenErr);
    }

    res.status(201).json({
      message: 'Attendance session started successfully',
      session: {
        ...session,
        course_code: classroomCheck.rows[0].course_code,
        course_name: classroomCheck.rows[0].course_name,
        section_name: classroomCheck.rows[0].section_name,
      },
      initial_tokens: tokenBatch,
    });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Failed to start attendance session' });
  }
});

// POST /sessions/:id/end — Teacher ends a live attendance session
router.post('/:id/end', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Check session exists and user is the teacher
    const sessionCheck = await db.query(
      `SELECT s.*, c.teacher_id, co.course_code, c.section_name
       FROM sessions s
       JOIN classrooms c ON s.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (sessionCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this session' });
    }

    if (sessionCheck.rows[0].ended_at) {
      return res.status(400).json({ error: 'Session is already ended' });
    }

    const endResult = await db.query(
      `UPDATE sessions
       SET ended_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId]
    );

    // Get attendance summary count
    const countResult = await db.query(
      'SELECT COUNT(*)::int as total_present FROM attendance_records WHERE session_id = $1',
      [sessionId]
    );

    // ---- Section 4b: Resolve pending PulseMeter activities ----
    // When an attendance Session ends, check for any LiveActivities in this
    // classroom where attendance_pending = TRUE. These are PulseMeters that
    // were launched before attendance was taken. Now that we have a finalized
    // "present" headcount, we can link them to this session.
    const classroomId = sessionCheck.rows[0].classroom_id;
    const pendingActivities = await db.query(
      `SELECT id FROM live_activities
       WHERE classroom_id = $1 AND attendance_pending = TRUE`,
      [classroomId]
    );

    if (pendingActivities.rows.length > 0) {
      const pendingIds = pendingActivities.rows.map((r) => r.id);
      await db.query(
        `UPDATE live_activities
         SET attendance_session_id = $1, attendance_pending = FALSE
         WHERE id = ANY($2::uuid[])`,
        [sessionId, pendingIds]
      );
      console.log(`[ClassPulse Session] Resolved ${pendingIds.length} pending live activities against session ${sessionId}`);
    }

    res.json({
      message: 'Attendance session ended successfully',
      session: endResult.rows[0],
      total_present: countResult.rows[0].total_present,
    });
  } catch (err) {
    console.error('Error ending session:', err);
    res.status(500).json({ error: 'Failed to end attendance session' });
  }
});

// GET /sessions/active-mine — Fetch all active (unended) sessions for the authenticated teacher
router.get('/active-mine', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, c.section_name, co.course_code, co.course_name
       FROM sessions s
       JOIN classrooms c ON s.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       WHERE c.teacher_id = $1 AND s.ended_at IS NULL
       ORDER BY s.started_at DESC`,
      [req.user.id]
    );

    const sessions = result.rows;

    res.json({
      sessions,
      // Backwards compatibility: older clients read a single `session` field.
      session: sessions[0] || null,
    });
  } catch (err) {
    console.error('Error fetching active teacher session:', err);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// GET /sessions/:id — Retrieve session details & status
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;

    const result = await db.query(
      `SELECT s.*, c.section_name, c.teacher_id, co.course_code, co.course_name, u.full_name as teacher_name,
              (SELECT COUNT(*)::int FROM attendance_records ar
                JOIN enrollments e ON e.classroom_id = c.id
                  AND e.student_id = ar.student_id
                  AND e.joined_at <= s.started_at
                WHERE ar.session_id = s.id) as present_count,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id AND e.joined_at <= s.started_at) as total_enrolled
       FROM sessions s
       JOIN classrooms c ON s.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    const isOwner = req.user.role === 'teacher' && session.teacher_id === req.user.id;
    const isMember = req.user.role === 'student' && await isEnrolled(req.user.id, session.classroom_id);

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this session' });
    }

    // Internal authorization field; not part of the public session shape.
    delete session.teacher_id;

    res.json({ session });
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// GET /sessions/:id/active-tokens — Generate/fetch current 3-QR token batch
router.get('/:id/active-tokens', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    const sessionCheck = await db.query(
      `SELECT s.*, c.teacher_id
       FROM sessions s
       JOIN classrooms c ON s.classroom_id = c.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (sessionCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this session' });
    }

    if (sessionCheck.rows[0].ended_at) {
      return res.status(400).json({ error: 'Cannot generate tokens for an ended session' });
    }

    const tokenBatch = await generate3QrSequence(sessionId);
    res.json({ token_batch: tokenBatch });
  } catch (err) {
    console.error('Error generating active tokens:', err);
    res.status(500).json({ error: 'Failed to generate active tokens' });
  }
});

module.exports = router;
