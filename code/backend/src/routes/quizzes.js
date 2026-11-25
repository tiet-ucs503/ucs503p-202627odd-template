const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const parsedLinkWindow = parseInt(process.env.ATTENDANCE_LINK_WINDOW_HOURS || '12', 10);
const ATTENDANCE_LINK_WINDOW_HOURS =
  Number.isFinite(parsedLinkWindow) && parsedLinkWindow >= 0 ? parsedLinkWindow : 12;

/**
 * POST /quizzes
 * Role: Teacher
 * Author a reusable live quiz with multi-choice questions and WIDE/NARROW scoring mode.
 */
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  let client = null;
  let inTransaction = false;
  try {
    client = await db.pool.connect();
    const { classroom_id, title, scoring_mode, questions } = req.body;

    if (!classroom_id || !title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'classroom_id, title, and at least 1 question are required.' });
    }

    const mode = (scoring_mode || 'WIDE').toUpperCase();
    if (!['WIDE', 'NARROW'].includes(mode)) {
      return res.status(400).json({ error: "scoring_mode must be either 'WIDE' or 'NARROW'." });
    }

    // Verify teacher owns the classroom
    const classroomCheck = await client.query(
      'SELECT id, section_name FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Classroom not found or you do not have permission to author quizzes for it.' });
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Quiz title cannot be empty.' });
    }

    // Validate each question
    const sanitizedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qText = String(q.question_text || '').trim();
      if (!qText) {
        return res.status(400).json({ error: `Question #${i + 1} text cannot be empty.` });
      }

      if (!q.options || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
        return res.status(400).json({ error: `Question #${i + 1} must have between 2 and 6 options.` });
      }

      const formattedOptions = q.options.map((opt, optIdx) => {
        const text = typeof opt === 'string' ? opt.trim() : String(opt.text || '').trim();
        const id = (opt && opt.id) ? String(opt.id).toLowerCase() : String.fromCharCode(97 + optIdx);
        return { id, text };
      });

      if (formattedOptions.some(opt => !opt.text)) {
        return res.status(400).json({ error: `All options in Question #${i + 1} must have non-empty text.` });
      }

      const validOptionIds = formattedOptions.map(o => o.id);
      const correctId = String(q.correct_option_id || '').toLowerCase();
      if (!correctId || !validOptionIds.includes(correctId)) {
        return res.status(400).json({
          error: `Question #${i + 1} must specify a valid correct_option_id from its options (${validOptionIds.join(', ')}).`,
        });
      }

      const timeLimit = parseInt(q.time_limit_seconds, 10) || 20;
      if (timeLimit < 5 || timeLimit > 120) {
        return res.status(400).json({ error: `Question #${i + 1} time limit must be between 5 and 120 seconds.` });
      }

      sanitizedQuestions.push({
        question_text: qText,
        options: formattedOptions,
        correct_option_id: correctId,
        order_index: i,
        time_limit_seconds: timeLimit,
      });
    }

    // Begin transaction for Quiz + Questions
    await client.query('BEGIN');
    inTransaction = true;

    const quizInsertRes = await client.query(
      `INSERT INTO quizzes (classroom_id, created_by, title, scoring_mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id, classroom_id, created_by, title, scoring_mode, created_at`,
      [classroom_id, req.user.id, trimmedTitle, mode]
    );
    const quiz = quizInsertRes.rows[0];

    const insertedQuestions = [];
    for (const sq of sanitizedQuestions) {
      const qRes = await client.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, options, correct_option_id, order_index, time_limit_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, quiz_id, question_text, options, correct_option_id, order_index, time_limit_seconds`,
        [quiz.id, sq.question_text, JSON.stringify(sq.options), sq.correct_option_id, sq.order_index, sq.time_limit_seconds]
      );
      insertedQuestions.push(qRes.rows[0]);
    }

    await client.query('COMMIT');
    inTransaction = false;

    res.status(201).json({
      message: 'Quiz authored successfully',
      quiz: {
        ...quiz,
        questions: insertedQuestions,
      },
    });
  } catch (err) {
    if (client && inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[ClassPulse Quiz] Error rolling back quiz creation:', rollbackErr);
      }
      inTransaction = false;
    }
    console.error('[ClassPulse Quiz] Error creating quiz:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to author quiz.' });
    }
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /quizzes?classroom_id=...
 * Role: Teacher
 * List reusable Quizzes authored for a classroom.
 */
router.get('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { classroom_id } = req.query;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id query parameter is required.' });
    }

    // Verify teacher owns the classroom
    const classroomCheck = await db.query(
      'SELECT id, section_name FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Classroom not found or unauthorized.' });
    }

    const quizzesRes = await db.query(
      `SELECT q.id, q.classroom_id, q.created_by, q.title, q.scoring_mode, q.created_at,
              u.full_name as created_by_name,
              COUNT(qq.id)::int as question_count
       FROM quizzes q
       JOIN users u ON q.created_by = u.id
       LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
       WHERE q.classroom_id = $1
       GROUP BY q.id, u.full_name
       ORDER BY q.created_at DESC`,
      [classroom_id]
    );

    // Fetch questions for each quiz
    const quizIds = quizzesRes.rows.map(q => q.id);
    let allQuestions = [];
    if (quizIds.length > 0) {
      const qRes = await db.query(
        `SELECT id, quiz_id, question_text, options, correct_option_id, order_index, time_limit_seconds
         FROM quiz_questions
         WHERE quiz_id = ANY($1::uuid[])
         ORDER BY order_index ASC`,
        [quizIds]
      );
      allQuestions = qRes.rows;
    }

    const quizzes = quizzesRes.rows.map(q => ({
      ...q,
      questions: allQuestions.filter(qq => qq.quiz_id === q.id),
    }));

    res.json({ quizzes });
  } catch (err) {
    console.error('[ClassPulse Quiz] Error fetching quizzes:', err);
    res.status(500).json({ error: 'Failed to fetch quizzes.' });
  }
});

/**
 * POST /quizzes/:id/launch
 * Role: Teacher
 * Launch a reusable Quiz as the classroom's active LiveActivity.
 * Enforces one-active-activity-per-classroom via partial unique index.
 * Resolves attendance (links recent ended session or sets attendance_pending = true).
 * Emits activity:launched via Socket.io.
 */
router.post('/:id/launch', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const quizId = req.params.id;

    // Verify quiz exists and teacher owns the classroom
    const quizCheck = await db.query(
      `SELECT q.*, c.teacher_id, c.id as classroom_id_verified
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE q.id = $1`,
      [quizId]
    );

    if (quizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizCheck.rows[0];

    if (quiz.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    // Fetch all questions for this quiz
    const questionsRes = await db.query(
      `SELECT id, quiz_id, question_text, options, correct_option_id, order_index, time_limit_seconds
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY order_index ASC`,
      [quizId]
    );

    if (questionsRes.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot launch a quiz with 0 questions' });
    }

    // Section 4b Present-vs-responded resolution. Only a session that ended
    // inside the configured window is recent enough to link.
    const recentSession = await db.query(
      `SELECT id FROM sessions
       WHERE classroom_id = $1 AND ended_at IS NOT NULL
         AND ended_at > now() - ($2 || ' hours')::interval
       ORDER BY started_at DESC
       LIMIT 1`,
      [quiz.classroom_id, String(ATTENDANCE_LINK_WINDOW_HOURS)]
    );

    let attendanceSessionId = null;
    let attendancePending = false;

    if (recentSession.rows.length > 0) {
      attendanceSessionId = recentSession.rows[0].id;
    } else {
      attendancePending = true;
    }

    // Create live activity (partial unique index enforces one-active-per-classroom).
    // The snapshot keeps this run readable even if the template is later edited/deleted.
    const configSnapshot = {
      scoring_mode: quiz.scoring_mode,
      questions: questionsRes.rows.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        correct_option_id: q.correct_option_id,
        order_index: q.order_index,
        time_limit_seconds: q.time_limit_seconds,
      })),
    };

    let liveActivity;
    try {
      const insertResult = await db.query(
        `INSERT INTO live_activities
           (classroom_id, activity_type, activity_ref_id, attendance_session_id, attendance_pending,
            title_snapshot, config_snapshot)
         VALUES ($1, 'QUIZ', $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          quiz.classroom_id,
          quizId,
          attendanceSessionId,
          attendancePending,
          quiz.title,
          JSON.stringify(configSnapshot),
        ]
      );
      liveActivity = insertResult.rows[0];
    } catch (insertErr) {
      if (insertErr.constraint === 'one_active_activity_per_classroom') {
        return res.status(409).json({
          error: 'Another activity is already live in this classroom. End it before launching a new quiz.',
        });
      }
      throw insertErr;
    }

    // Strip correct_option_id for broadcast to students
    const sanitizedQuestions = questionsRes.rows.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      order_index: q.order_index,
      time_limit_seconds: q.time_limit_seconds,
    }));

    // Emit activity:launched to classroom room
    const io = req.app.get('io');
    io.to(`classroom_${quiz.classroom_id}`).emit('activity:launched', {
      activityId: liveActivity.id,
      activityType: 'QUIZ',
      quiz: {
        id: quiz.id,
        title: quiz.title,
        scoring_mode: quiz.scoring_mode,
        question_count: questionsRes.rows.length,
        questions: sanitizedQuestions,
      },
    });

    res.status(201).json({
      message: 'Live Quiz launched successfully',
      activity: liveActivity,
      quiz: {
        ...quiz,
        questions: questionsRes.rows,
      },
      attendancePending,
    });
  } catch (err) {
    console.error('[ClassPulse Quiz] Error launching quiz:', err);
    res.status(500).json({ error: 'Failed to launch quiz' });
  }
});

/**
 * DELETE /quizzes/:id
 * Role: Teacher
 * Delete an authored Quiz and its questions.
 */
router.delete('/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const quizId = req.params.id;

    const quizCheck = await db.query(
      `SELECT q.id, c.teacher_id 
       FROM quizzes q 
       JOIN classrooms c ON q.classroom_id = c.id 
       WHERE q.id = $1`,
      [quizId]
    );

    if (quizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    if (quizCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this Quiz.' });
    }

    // Runs are historical records: refuse to delete a quiz that was launched.
    const historyCheck = await db.query(
      'SELECT 1 FROM live_activities WHERE activity_ref_id = $1 AND activity_type = $2 LIMIT 1',
      [quizId, 'QUIZ']
    );

    if (historyCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This quiz has live-run history and cannot be deleted.' });
    }

    await db.query('DELETE FROM quizzes WHERE id = $1', [quizId]);

    res.json({ message: 'Quiz deleted successfully.' });
  } catch (err) {
    console.error('[ClassPulse Quiz] Error deleting Quiz:', err);
    res.status(500).json({ error: 'Failed to delete Quiz.' });
  }
});

module.exports = router;


