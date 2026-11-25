const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { isEnrolled } = require('../utils/access');

const router = express.Router();

// Helper to generate a clean 6-character human-readable join code
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // 32 characters divides 256 evenly, so modulo introduces no bias.
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

// POST /classrooms — Teacher creates a classroom section
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { course_id, section_name } = req.body;

    if (!course_id || !section_name) {
      return res.status(400).json({ error: 'course_id and section_name are required' });
    }

    // Verify course exists
    const courseCheck = await db.query('SELECT * FROM courses WHERE id = $1', [course_id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Selected course not found' });
    }

    // Generate unique join code
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const codeCheck = await db.query('SELECT id FROM classrooms WHERE join_code = $1', [joinCode]);
      if (codeCheck.rows.length === 0) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Could not generate a unique join code. Please try again.' });
    }

    const newClassroomResult = await db.query(
      `INSERT INTO classrooms (course_id, teacher_id, section_name, join_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id, course_id, teacher_id, section_name, join_code, created_at`,
      [course_id, req.user.id, section_name.trim(), joinCode]
    );

    const classroom = newClassroomResult.rows[0];

    res.status(201).json({
      message: 'Classroom created successfully',
      classroom: {
        ...classroom,
        course_code: courseCheck.rows[0].course_code,
        course_name: courseCheck.rows[0].course_name,
        teacher_name: req.user.full_name,
        student_count: 0,
      },
    });
  } catch (err) {
    console.error('Error creating classroom:', err);
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

// POST /classrooms/:id/regenerate-join — Teacher rotates join code
router.post('/:id/regenerate-join', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await db.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    const newJoinCode = generateJoinCode();
    let joinCodeUnique = false;
    let regenerateAttempts = 0;
    let candidateCode = newJoinCode;
    while (!joinCodeUnique && regenerateAttempts < 10) {
      const codeCheck = await db.query('SELECT id FROM classrooms WHERE join_code = $1', [candidateCode]);
      if (codeCheck.rows.length === 0) {
        joinCodeUnique = true;
      } else {
        candidateCode = generateJoinCode();
        regenerateAttempts++;
      }
    }

    if (!joinCodeUnique) {
      return res.status(500).json({ error: 'Could not generate a unique join code. Please try again.' });
    }

    const updateResult = await db.query(
      'UPDATE classrooms SET join_code = $1 WHERE id = $2 RETURNING *',
      [candidateCode, classroomId]
    );

    res.json({
      message: 'Join code regenerated successfully',
      classroom: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error regenerating join code:', err);
    res.status(500).json({ error: 'Failed to regenerate join code' });
  }
});

// POST /classrooms/join — Student joins classroom section via join code
router.post('/join', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { join_code } = req.body;

    if (!join_code) {
      return res.status(400).json({ error: 'Join code is required' });
    }

    const cleanCode = join_code.trim().toUpperCase();

    // Find classroom by join code
    const classResult = await db.query(
      `SELECT c.*, co.course_code, co.course_name, u.full_name as teacher_name
       FROM classrooms c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       WHERE c.join_code = $1`,
      [cleanCode]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid join code. No active classroom found.' });
    }

    const classroom = classResult.rows[0];

    // Check if already enrolled
    const enrollCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroom.id, req.user.id]
    );

    if (enrollCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You are already enrolled in this classroom section.' });
    }

    // Insert enrollment
    await db.query(
      'INSERT INTO enrollments (classroom_id, student_id) VALUES ($1, $2)',
      [classroom.id, req.user.id]
    );

    res.status(200).json({
      message: `Successfully joined ${classroom.course_code}: ${classroom.course_name}`,
      classroom,
    });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'You are already enrolled in this classroom section.' });
    }
    console.error('Error joining classroom:', err);
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

// GET /classrooms/mine — List classrooms for authenticated user with cross-feature micro-metrics
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const result = await db.query(
        `SELECT c.*, co.course_code, co.course_name,
                $2::text as teacher_name,
                (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id) as student_count,
                (SELECT COUNT(*)::int FROM quizzes q WHERE q.classroom_id = c.id) as quiz_count,
                (SELECT COUNT(*)::int FROM pulsemeters p WHERE p.classroom_id = c.id) as pulsemeter_count,
                (SELECT COUNT(*)::int FROM doubt_posts dp WHERE (dp.classroom_id = c.id OR (dp.course_id = c.course_id AND dp.audience_scope IN ('COURSE', 'APP'))) AND dp.status = 'OPEN') as open_doubts_count,
                (SELECT COUNT(*)::int FROM doubt_posts dp WHERE (dp.classroom_id = c.id OR (dp.course_id = c.course_id AND dp.audience_scope IN ('COURSE', 'APP'))) AND dp.status = 'RESOLVED') as resolved_doubts_count,
                ROUND(
                  (
                    SELECT AVG(
                      CASE
                        WHEN (
                          SELECT COUNT(*) FROM enrollments e
                          WHERE e.classroom_id = c.id
                            AND e.joined_at <= s.started_at
                        ) > 0
                        THEN (
                          SELECT COUNT(*)::numeric
                          FROM attendance_records ar
                          JOIN enrollments e
                            ON e.classroom_id = c.id
                           AND e.student_id = ar.student_id
                           AND e.joined_at <= s.started_at
                          WHERE ar.session_id = s.id
                        ) / (
                          SELECT COUNT(*)::numeric FROM enrollments e
                          WHERE e.classroom_id = c.id
                            AND e.joined_at <= s.started_at
                        ) * 100
                        ELSE NULL
                      END
                    )
                    FROM sessions s
                    WHERE s.classroom_id = c.id AND s.ended_at IS NOT NULL
                  ), 1
                )::float as attendance_avg_rate
         FROM classrooms c
         JOIN courses co ON c.course_id = co.id
         WHERE c.teacher_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.id, req.user.full_name]
      );
      return res.json({ classrooms: result.rows });
    } else {
      const result = await db.query(
        `SELECT c.*, co.course_code, co.course_name, u.full_name as teacher_name,
                (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id) as student_count,
                (SELECT COUNT(*)::int FROM quizzes q WHERE q.classroom_id = c.id) as quiz_count,
                (SELECT COUNT(*)::int FROM pulsemeters p WHERE p.classroom_id = c.id) as pulsemeter_count,
                (SELECT COUNT(*)::int FROM doubt_posts dp WHERE (dp.classroom_id = c.id OR (dp.course_id = c.course_id AND dp.audience_scope IN ('COURSE', 'APP'))) AND dp.status = 'OPEN') as open_doubts_count,
                (SELECT COUNT(*)::int FROM doubt_posts dp WHERE (dp.classroom_id = c.id OR (dp.course_id = c.course_id AND dp.audience_scope IN ('COURSE', 'APP'))) AND dp.status = 'RESOLVED') as resolved_doubts_count,
                COALESCE(
                  ROUND(
                    (
                      CASE WHEN (SELECT COUNT(*) FROM sessions s WHERE s.classroom_id = c.id AND s.ended_at IS NOT NULL AND s.started_at >= en.joined_at) > 0
                           THEN (SELECT COUNT(*)::numeric FROM attendance_records ar JOIN sessions s ON ar.session_id = s.id WHERE s.classroom_id = c.id AND ar.student_id = $1 AND s.started_at >= en.joined_at AND s.ended_at IS NOT NULL) / (SELECT COUNT(*)::numeric FROM sessions s WHERE s.classroom_id = c.id AND s.ended_at IS NOT NULL AND s.started_at >= en.joined_at) * 100
                           ELSE 0
                      END
                    ), 1
                  ), 0
                )::float as attendance_avg_rate,
                en.joined_at
         FROM enrollments en
         JOIN classrooms c ON en.classroom_id = c.id
         JOIN courses co ON c.course_id = co.id
         JOIN users u ON c.teacher_id = u.id
         WHERE en.student_id = $1
         ORDER BY en.joined_at DESC`,
        [req.user.id]
      );
      return res.json({ classrooms: result.rows });
    }
  } catch (err) {
    console.error('Error fetching classrooms:', err);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// GET /classrooms/:id/summary — Aggregated cross-feature summary metrics for classroom overview
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Verify classroom exists
    const classResult = await db.query(
      `SELECT c.*, co.course_code, co.course_name, u.full_name as teacher_name,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id) as student_count
       FROM classrooms c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       WHERE c.id = $1`,
      [classroomId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const classroom = classResult.rows[0];

    const isOwner = req.user.role === 'teacher' && classroom.teacher_id === req.user.id;
    const isMember = req.user.role === 'student' && await isEnrolled(req.user.id, classroomId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this classroom' });
    }

    // The join code is a secret used to enrol; never expose it to students.
    if (isMember) {
      delete classroom.join_code;
    }

    // Attendance stats
    const attendanceStats = await db.query(
      `SELECT COUNT(*)::int as total_sessions,
              ROUND(
                AVG(
                  CASE
                    WHEN (
                      SELECT COUNT(*) FROM enrollments e
                      WHERE e.classroom_id = s.classroom_id
                        AND e.joined_at <= s.started_at
                    ) > 0
                    THEN (
                      SELECT COUNT(*)::numeric
                      FROM attendance_records ar
                      JOIN enrollments e
                        ON e.classroom_id = s.classroom_id
                       AND e.student_id = ar.student_id
                       AND e.joined_at <= s.started_at
                      WHERE ar.session_id = s.id
                    ) / (
                      SELECT COUNT(*)::numeric FROM enrollments e
                      WHERE e.classroom_id = s.classroom_id
                        AND e.joined_at <= s.started_at
                    ) * 100
                    ELSE NULL
                  END
                ), 1
              )::float as avg_turnout_pct
       FROM sessions s
       WHERE s.classroom_id = $1 AND s.ended_at IS NOT NULL`,
      [classroomId]
    );

    // Engagement stats (PulseMeters, Quizzes, Active Activity)
    const pulsemeterCount = await db.query(
      `SELECT COUNT(*)::int FROM pulsemeters WHERE classroom_id = $1`,
      [classroomId]
    );

    const quizCount = await db.query(
      `SELECT COUNT(*)::int FROM quizzes WHERE classroom_id = $1`,
      [classroomId]
    );

    const activeActivity = await db.query(
      `SELECT * FROM live_activities WHERE classroom_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [classroomId]
    );

    // Doubt Forum stats
    const doubtStats = await db.query(
      `SELECT COUNT(DISTINCT dp.id)::int as total_doubts,
              COUNT(DISTINCT CASE WHEN dp.status = 'OPEN' THEN dp.id END)::int as open_doubts,
              COUNT(DISTINCT CASE WHEN dp.status = 'RESOLVED' THEN dp.id END)::int as resolved_doubts,
              COUNT(dr.id)::int as total_replies
       FROM doubt_posts dp
       LEFT JOIN doubt_replies dr ON dp.id = dr.doubt_post_id
       WHERE dp.classroom_id = $1 OR (dp.course_id = $2 AND dp.audience_scope IN ('COURSE', 'APP'))`,
      [classroomId, classroom.course_id]
    );

    res.json({
      classroom,
      attendance: {
        total_sessions: attendanceStats.rows[0].total_sessions,
        avg_turnout_pct: attendanceStats.rows[0].avg_turnout_pct,
      },
      engagement: {
        pulsemeter_count: pulsemeterCount.rows[0].count,
        quiz_count: quizCount.rows[0].count,
        has_active_activity: activeActivity.rows.length > 0,
        active_activity: activeActivity.rows[0] || null,
      },
      forum: doubtStats.rows[0],
    });
  } catch (err) {
    console.error('Error fetching classroom summary:', err);
    res.status(500).json({ error: 'Failed to fetch classroom summary' });
  }
});

// GET /classrooms/:id/roster — Teacher views enrolled student roster for section
router.get('/:id/roster', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await db.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    const rosterResult = await db.query(
      `SELECT u.id as student_id, u.full_name, u.email, en.joined_at
       FROM enrollments en
       JOIN users u ON en.student_id = u.id
       WHERE en.classroom_id = $1
       ORDER BY u.full_name ASC`,
      [classroomId]
    );

    res.json({
      classroom_id: classroomId,
      roster: rosterResult.rows,
    });
  } catch (err) {
    console.error('Error fetching roster:', err);
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

// DELETE /classrooms/:id/roster/:student_id — Teacher removes/unenrolls a student from their section
router.delete('/:id/roster/:student_id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { id: classroomId, student_id: studentId } = req.params;

    // Verify teacher owns this classroom
    const classCheck = await db.query('SELECT teacher_id FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    // Verify student is enrolled
    const enrollCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroomId, studentId]
    );

    if (enrollCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student is not enrolled in this classroom' });
    }

    // Remove enrollment
    await db.query(
      'DELETE FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroomId, studentId]
    );

    res.json({ message: 'Student removed from classroom roster successfully' });
  } catch (err) {
    console.error('Error removing student from roster:', err);
    res.status(500).json({ error: 'Failed to remove student from roster' });
  }
});

// DELETE /classrooms/:id — Teacher permanently deletes a classroom and all related data
router.delete('/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  let client;
  let inTransaction = false;
  try {
    client = await db.pool.connect();
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await client.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    await client.query('BEGIN');
    inTransaction = true;

    // Cascade delete: attendance_records → sessions → enrollments → classroom
    await client.query(
      `DELETE FROM attendance_records
       WHERE session_id IN (SELECT id FROM sessions WHERE classroom_id = $1)`,
      [classroomId]
    );
    await client.query('DELETE FROM sessions WHERE classroom_id = $1', [classroomId]);
    await client.query('DELETE FROM enrollments WHERE classroom_id = $1', [classroomId]);
    await client.query('DELETE FROM classrooms WHERE id = $1', [classroomId]);

    await client.query('COMMIT');
    inTransaction = false;

    res.json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    if (client && inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error rolling back classroom deletion:', rollbackErr.message);
      }
    }
    console.error('Error deleting classroom:', err);
    res.status(500).json({ error: 'Failed to delete classroom' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /classrooms/:id/leave — Student unenrolls from a classroom
router.delete('/:id/leave', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check enrollment exists
    const enrollCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroomId, req.user.id]
    );

    if (enrollCheck.rows.length === 0) {
      return res.status(404).json({ error: 'You are not enrolled in this classroom' });
    }

    await db.query(
      'DELETE FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroomId, req.user.id]
    );

    res.json({ message: 'Successfully unenrolled from classroom' });
  } catch (err) {
    console.error('Error unenrolling from classroom:', err);
    res.status(500).json({ error: 'Failed to unenroll from classroom' });
  }
});

module.exports = router;
