const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkProfanity } = require('../utils/profanityFilter');

const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function percent(part, whole) {
  return whole > 0 ? round1((part / whole) * 100) : 0;
}

/**
 * Resolve the question list for a quiz run.
 * Prefers the immutable launch snapshot so editing/deleting the template does
 * not rewrite or destroy the history of a run. Falls back to quiz_questions
 * for activities launched before snapshots existed.
 */
async function loadQuizQuestions(activity) {
  const snapshot = activity.config_snapshot;
  if (snapshot && Array.isArray(snapshot.questions) && snapshot.questions.length > 0) {
    return snapshot.questions
      .filter((q) => q && q.id)
      .map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_option_id: q.correct_option_id,
        order_index: Number.isInteger(q.order_index) ? q.order_index : 0,
        time_limit_seconds: q.time_limit_seconds || 20,
      }))
      .sort((a, b) => a.order_index - b.order_index);
  }

  const res = await db.query(
    `SELECT id, question_text, options, correct_option_id, order_index, time_limit_seconds
     FROM quiz_questions
     WHERE quiz_id = $1
     ORDER BY order_index ASC`,
    [activity.activity_ref_id]
  );
  return res.rows;
}

async function getQuizActivity(activityId) {
  const res = await db.query(
    `SELECT la.*,
            c.teacher_id,
            COALESCE(la.title_snapshot, q.title) AS resolved_title,
            COALESCE(q.scoring_mode, la.config_snapshot->>'scoring_mode') AS resolved_scoring_mode
     FROM live_activities la
     JOIN classrooms c ON la.classroom_id = c.id
     LEFT JOIN quizzes q ON la.activity_type = 'QUIZ' AND la.activity_ref_id = q.id
     WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
    [activityId]
  );
  return res.rows[0] || null;
}

async function getQuestionState(activityId, questionId) {
  const res = await db.query(
    `SELECT * FROM activity_question_states
     WHERE live_activity_id = $1 AND question_id = $2`,
    [activityId, questionId]
  );
  return res.rows[0] || null;
}

async function getLatestQuestionState(activityId) {
  const res = await db.query(
    `SELECT * FROM activity_question_states
     WHERE live_activity_id = $1
     ORDER BY started_at_ms DESC
     LIMIT 1`,
    [activityId]
  );
  return res.rows[0] || null;
}

/**
 * GET /live-activities?classroom_id=...&activity_type=...&status=...&limit=&offset=
 * Role: Teacher (classroom owner)
 * Paginated history index of live runs with per-run summary stats.
 */
router.get('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { classroom_id, activity_type, status } = req.query;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id query parameter is required' });
    }

    if (!isUuid(classroom_id)) {
      return res.status(400).json({ error: 'Invalid classroom_id' });
    }

    if (activity_type !== undefined && !['PULSEMETER', 'QUIZ'].includes(activity_type)) {
      return res.status(400).json({ error: "activity_type must be 'PULSEMETER' or 'QUIZ'" });
    }

    if (status !== undefined && !['ACTIVE', 'ENDED'].includes(status)) {
      return res.status(400).json({ error: "status must be 'ACTIVE' or 'ENDED'" });
    }

    const classroomCheck = await db.query(
      'SELECT id, teacher_id FROM classrooms WHERE id = $1',
      [classroom_id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroomCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    let limit = parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) limit = 20;
    limit = Math.min(limit, 100);

    let offset = parseInt(req.query.offset, 10);
    if (!Number.isInteger(offset) || offset < 0) offset = 0;

    const params = [classroom_id];
    const conditions = ['la.classroom_id = $1'];

    if (activity_type) {
      params.push(activity_type);
      conditions.push(`la.activity_type = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`la.status = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM live_activities la WHERE ${where}`,
      params
    );

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rowsRes = await db.query(
      `SELECT la.id,
              la.activity_type,
              la.status,
              la.started_at,
              la.ended_at,
              la.attendance_session_id,
              la.attendance_pending,
              COALESCE(la.title_snapshot, p.title, q.title) AS title,
              CASE WHEN la.activity_type = 'PULSEMETER'
                   THEN COALESCE(p.type, la.config_snapshot->>'type')
                   ELSE NULL END AS type,
              CASE WHEN la.activity_type = 'QUIZ'
                   THEN COALESCE(q.scoring_mode, la.config_snapshot->>'scoring_mode')
                   ELSE NULL END AS scoring_mode,
              CASE WHEN la.activity_type = 'QUIZ'
                   THEN CASE
                          WHEN jsonb_typeof(la.config_snapshot->'questions') = 'array'
                            THEN jsonb_array_length(la.config_snapshot->'questions')
                          ELSE (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = la.activity_ref_id)
                        END
                   ELSE 0 END AS question_count,
              CASE WHEN la.activity_type = 'QUIZ'
                   THEN (SELECT COUNT(DISTINCT qr.student_id)::int FROM quiz_responses qr WHERE qr.live_activity_id = la.id)
                   ELSE (SELECT COUNT(*)::int FROM pulsemeter_responses pr WHERE pr.live_activity_id = la.id)
                   END AS response_count,
              CASE WHEN la.activity_type = 'QUIZ'
                   THEN (SELECT COUNT(DISTINCT qr.student_id)::int FROM quiz_responses qr WHERE qr.live_activity_id = la.id)
                   ELSE (SELECT COUNT(DISTINCT pr.student_id)::int FROM pulsemeter_responses pr WHERE pr.live_activity_id = la.id)
                   END AS participant_count,
              COALESCE((SELECT COUNT(*)::int FROM attendance_records ar
                        WHERE ar.session_id = la.attendance_session_id), 0) AS present_count,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = la.classroom_id) AS enrolled_count,
              CASE WHEN la.activity_type = 'PULSEMETER'
                   THEN (SELECT COUNT(*)::int FROM pulsemeter_responses pr
                         WHERE pr.live_activity_id = la.id AND pr.is_blocked = true)
                   ELSE 0 END AS blocked_count,
              CASE WHEN la.activity_type = 'QUIZ'
                   THEN (SELECT ROUND(AVG(t.total_score)::numeric, 1)::float8
                         FROM (SELECT SUM(qr.score_awarded)::numeric AS total_score
                               FROM quiz_responses qr
                               WHERE qr.live_activity_id = la.id
                               GROUP BY qr.student_id) t)
                   ELSE NULL END AS avg_score
       FROM live_activities la
       LEFT JOIN pulsemeters p
         ON la.activity_type = 'PULSEMETER' AND la.activity_ref_id = p.id
       LEFT JOIN quizzes q
         ON la.activity_type = 'QUIZ' AND la.activity_ref_id = q.id
       WHERE ${where}
       ORDER BY la.started_at DESC, la.id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    res.json({
      activities: rowsRes.rows,
      total: countRes.rows[0].total,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error fetching activity history:', err);
    res.status(500).json({ error: 'Failed to fetch activity history' });
  }
});

/**
 * POST /live-activities/:id/end
 * Role: Teacher
 * End the currently active live activity (PulseMeter or Quiz).
 * Quizzes share the exact final-leaderboard behaviour of /quiz/end.
 */
router.post('/:id/end', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    // Verify the activity exists, is ACTIVE, and teacher owns the classroom
    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id, c.id as cid
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    if (activity.status !== 'ACTIVE') {
      if (activity.activity_type === 'QUIZ') {
        return res.status(409).json({ error: 'Quiz already ended.' });
      }
      return res.status(400).json({ error: 'Activity is not currently active' });
    }

    const io = req.app.get('io');

    // Quizzes must finalize the leaderboard and emit quiz:ended, exactly like /quiz/end.
    if (activity.activity_type === 'QUIZ') {
      const endResult = await db.query(
        `UPDATE live_activities
         SET status = 'ENDED', ended_at = now()
         WHERE id = $1
         RETURNING *`,
        [activityId]
      );

      const finalLeaderboard = await computeQuizLeaderboard(activityId);
      const podium = finalLeaderboard.slice(0, 3);

      if (io) {
        io.to(`classroom_${activity.classroom_id}`).emit('quiz:ended', {
          activityId,
          finalLeaderboard,
          podium,
        });
      }

      return res.json({
        message: 'Quiz session concluded successfully',
        activity: endResult.rows[0],
        finalLeaderboard,
        podium,
      });
    }

    // PulseMeter: preserve the existing behaviour.
    const endResult = await db.query(
      `UPDATE live_activities
       SET status = 'ENDED', ended_at = now()
       WHERE id = $1
       RETURNING *`,
      [activityId]
    );

    // Get final response count
    const countResult = await db.query(
      'SELECT COUNT(*)::int as total FROM pulsemeter_responses WHERE live_activity_id = $1',
      [activityId]
    );

    // Emit activity:ended to classroom
    if (io) {
      io.to(`classroom_${activity.classroom_id}`).emit('activity:ended', {
        activityId,
        activityType: activity.activity_type,
      });
    }

    res.json({
      message: 'Live activity ended successfully',
      activity: endResult.rows[0],
      totalResponses: countResult.rows[0].total,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error ending activity:', err);
    res.status(500).json({ error: 'Failed to end live activity' });
  }
});

/**
 * POST /live-activities/:id/respond
 * Role: Student (enrolled)
 * Submit a PulseMeter response. Validates enrollment, active status, mute status,
 * and uniqueness. Emits live aggregated results to the teacher via Socket.io.
 */
router.post('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;
    const { response_value } = req.body;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit responses' });
    }

    if (!response_value && response_value !== 0) {
      return res.status(400).json({ error: 'response_value is required' });
    }

    // Fetch the live activity, pulsemeter details, and classroom.
    // Snapshot first so a deleted/edited template does not break a live run.
    const activityCheck = await db.query(
      `SELECT la.*,
              COALESCE(la.config_snapshot->>'type', p.type) as pm_type,
              COALESCE(la.config_snapshot->'config', p.config) as pm_config,
              COALESCE(la.title_snapshot, p.title) as pm_title
       FROM live_activities la
       LEFT JOIN pulsemeters p ON la.activity_type = 'PULSEMETER' AND la.activity_ref_id = p.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0 || !activityCheck.rows[0].pm_type) {
      return res.status(404).json({ error: 'PulseMeter activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'This PulseMeter is no longer active' });
    }

    // Verify student is enrolled in the classroom
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [activity.classroom_id, req.user.id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom' });
    }

    // For WORD_CLOUD: check if student is muted
    if (activity.pm_type === 'WORD_CLOUD') {
      const muteCheck = await db.query(
        `SELECT id FROM word_cloud_mutes
         WHERE student_id = $1 AND classroom_id = $2 AND muted_until > now()
         LIMIT 1`,
        [req.user.id, activity.classroom_id]
      );

      if (muteCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'You are currently muted from word-cloud participation in this classroom',
        });
      }
    }

    // Validate response_value based on type
    const responseStr = String(response_value).trim();
    if (!responseStr) {
      return res.status(400).json({ error: 'Response cannot be empty' });
    }

    let isBlocked = false;
    let blockedReason = null;

    if (activity.pm_type === 'MCQ') {
      const validOptionIds = (activity.pm_config.options || []).map((o) => o.id);
      if (!validOptionIds.includes(responseStr)) {
        return res.status(400).json({ error: `Invalid option. Must be one of: ${validOptionIds.join(', ')}` });
      }
    } else if (activity.pm_type === 'RATING_SCALE') {
      const rating = parseInt(responseStr, 10);
      if (isNaN(rating) || rating < (activity.pm_config.min || 1) || rating > (activity.pm_config.max || 5)) {
        return res.status(400).json({
          error: `Rating must be between ${activity.pm_config.min || 1} and ${activity.pm_config.max || 5}`,
        });
      }
    } else if (activity.pm_type === 'WORD_CLOUD') {
      if (responseStr.length > 60) {
        return res.status(400).json({ error: 'Response is too long (max 60 characters).' });
      }

      // Automatic profanity & offensive language check
      const filterResult = checkProfanity(responseStr);
      if (filterResult.isBlocked) {
        isBlocked = true;
        blockedReason = filterResult.reason;
      }
    }

    // Insert response (unique constraint prevents duplicates)
    try {
      await db.query(
        `INSERT INTO pulsemeter_responses (live_activity_id, student_id, response_value, is_blocked, blocked_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [activityId, req.user.id, responseStr, isBlocked, blockedReason]
      );
    } catch (insertErr) {
      if (insertErr.constraint === 'pulsemeter_responses_live_activity_id_student_id_key') {
        return res.status(409).json({ error: 'You have already responded to this PulseMeter' });
      }
      throw insertErr;
    }

    // Compute aggregated results for live broadcast
    const aggregated = await computeAggregatedResults(activityId, activity);

    // Emit live results to teacher
    const io = req.app.get('io');
    if (io) {
      io.to(`activity_${activityId}_teacher`).emit('pulsemeter:results', {
        activityId,
        ...aggregated,
      });

      io.to(`activity_${activityId}_teacher`).emit('activity:response_count', {
        activityId,
        responseCount: aggregated.responseCount,
        presentCount: aggregated.presentCount,
        attendancePending: aggregated.attendancePending,
      });
    }

    res.status(201).json({
      message: 'Response submitted successfully',
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error submitting response:', err);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

/**
 * GET /live-activities/:id/analytics
 * Role: Teacher
 * Returns present-vs-responded data and type-specific distribution charts.
 * Works even if the PulseMeter template was deleted (reads the launch snapshot).
 */
router.get('/:id/analytics', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    // Fetch activity + snapshot/template + classroom ownership.
    // LEFT JOIN keeps the run readable after the template row is deleted.
    const activityCheck = await db.query(
      `SELECT la.*,
              COALESCE(p.id, la.activity_ref_id) as pm_id,
              COALESCE(la.title_snapshot, p.title) as pm_title,
              COALESCE(la.config_snapshot->>'type', p.type) as pm_type,
              COALESCE(la.config_snapshot->'config', p.config) as pm_config,
              c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       LEFT JOIN pulsemeters p ON la.activity_type = 'PULSEMETER' AND la.activity_ref_id = p.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0 || !activityCheck.rows[0].pm_type) {
      return res.status(404).json({ error: 'PulseMeter activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const aggregated = await computeAggregatedResults(activityId, activity);

    res.json({
      pulsemeter: {
        id: activity.pm_id,
        title: activity.pm_title,
        type: activity.pm_type,
        config: activity.pm_config,
      },
      liveActivity: {
        id: activity.id,
        classroom_id: activity.classroom_id,
        status: activity.status,
        started_at: activity.started_at,
        ended_at: activity.ended_at,
        attendance_session_id: activity.attendance_session_id,
        attendance_pending: activity.attendance_pending,
      },
      ...aggregated,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /live-activities/:id/word-cloud-submissions
 * Role: Teacher
 * Returns all student submissions for a Word Cloud activity, including student details,
 * response values, and whether they were auto-blocked.
 */
router.get('/:id/word-cloud-submissions', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live activity not found' });
    }

    if (activityCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    const result = await db.query(
      `SELECT 
         r.id,
         r.student_id,
         u.full_name as student_name,
         u.email as student_email,
         r.response_value,
         r.is_blocked,
         r.blocked_reason,
         r.submitted_at
       FROM pulsemeter_responses r
       JOIN users u ON r.student_id = u.id
       WHERE r.live_activity_id = $1
       ORDER BY r.submitted_at DESC`,
      [activityId]
    );

    res.json({ submissions: result.rows });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error fetching word cloud submissions:', err);
    res.status(500).json({ error: 'Failed to fetch word cloud submissions' });
  }
});

/**
 * POST /live-activities/:id/responses/:responseId/approve
 * Role: Teacher
 * Approves an auto-blocked submission (e.g. false positive), adding it immediately to the live Word Cloud.
 */
router.post('/:id/responses/:responseId/approve', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { id: activityId, responseId } = req.params;

    if (!isUuid(activityId) || !isUuid(responseId)) {
      return res.status(400).json({ error: 'Invalid activity or response id' });
    }

    const activityCheck = await db.query(
      `SELECT la.*,
              c.teacher_id,
              COALESCE(la.config_snapshot->>'type', pm.type) as pm_type,
              COALESCE(la.config_snapshot->'config', pm.config) as pm_config
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       LEFT JOIN pulsemeters pm ON la.activity_type = 'PULSEMETER' AND la.activity_ref_id = pm.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0 || !activityCheck.rows[0].pm_type) {
      return res.status(404).json({ error: 'Live activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    const updateRes = await db.query(
      `UPDATE pulsemeter_responses
       SET is_blocked = false, blocked_reason = NULL
       WHERE id = $1 AND live_activity_id = $2
       RETURNING id, student_id, response_value, is_blocked`,
      [responseId, activityId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Recompute and emit live update
    const aggregated = await computeAggregatedResults(activityId, activity);
    const io = req.app.get('io');
    if (io) {
      io.to(`activity_${activityId}_teacher`).emit('pulsemeter:results', {
        activityId,
        ...aggregated,
      });
    }

    res.json({
      message: 'Submission approved and added to Word Cloud',
      response: updateRes.rows[0],
      aggregated,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error approving response:', err);
    res.status(500).json({ error: 'Failed to approve response' });
  }
});

/**
 * DELETE /live-activities/:id/responses/:responseId
 * Role: Teacher
 * Permanently removes an offensive submission from the session.
 */
router.delete('/:id/responses/:responseId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { id: activityId, responseId } = req.params;

    if (!isUuid(activityId) || !isUuid(responseId)) {
      return res.status(400).json({ error: 'Invalid activity or response id' });
    }

    const activityCheck = await db.query(
      `SELECT la.*,
              c.teacher_id,
              COALESCE(la.config_snapshot->>'type', pm.type) as pm_type,
              COALESCE(la.config_snapshot->'config', pm.config) as pm_config
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       LEFT JOIN pulsemeters pm ON la.activity_type = 'PULSEMETER' AND la.activity_ref_id = pm.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0 || !activityCheck.rows[0].pm_type) {
      return res.status(404).json({ error: 'Live activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    const deleteRes = await db.query(
      `DELETE FROM pulsemeter_responses WHERE id = $1 AND live_activity_id = $2`,
      [responseId, activityId]
    );

    if (deleteRes.rowCount === 0 || (Array.isArray(deleteRes.rows) && deleteRes.rows.length === 0)) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Recompute and emit live update
    const aggregated = await computeAggregatedResults(activityId, activity);
    const io = req.app.get('io');
    if (io) {
      io.to(`activity_${activityId}_teacher`).emit('pulsemeter:results', {
        activityId,
        ...aggregated,
      });
    }

    res.json({ message: 'Submission deleted successfully', aggregated });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error deleting response:', err);
    res.status(500).json({ error: 'Failed to delete response' });
  }
});

/**
 * GET /live-activities/active?classroom_id=...
 * Role: Any authenticated member of the classroom
 * Check if there's a currently active live activity (PulseMeter or Quiz) for a classroom.
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { classroom_id } = req.query;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id query parameter is required' });
    }

    if (!isUuid(classroom_id)) {
      return res.status(400).json({ error: 'Invalid classroom_id' });
    }

    // Membership / ownership check before exposing anything about the activity.
    const classroomRes = await db.query(
      'SELECT id, teacher_id FROM classrooms WHERE id = $1',
      [classroom_id]
    );

    if (classroomRes.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const classroom = classroomRes.rows[0];

    if (req.user.role === 'teacher') {
      if (classroom.teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
      }
    } else if (req.user.role === 'student') {
      const enrollment = await db.query(
        'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
        [classroom_id, req.user.id]
      );
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this classroom' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query(
      `SELECT la.*,
              COALESCE(la.title_snapshot, p.title) as pm_title,
              COALESCE(la.config_snapshot->>'type', p.type) as pm_type,
              COALESCE(la.config_snapshot->'config', p.config) as pm_config,
              COALESCE(la.title_snapshot, q.title) as quiz_title,
              COALESCE(q.scoring_mode, la.config_snapshot->>'scoring_mode') as quiz_scoring_mode
       FROM live_activities la
       LEFT JOIN pulsemeters p ON la.activity_ref_id = p.id AND la.activity_type = 'PULSEMETER'
       LEFT JOIN quizzes q ON la.activity_ref_id = q.id AND la.activity_type = 'QUIZ'
       WHERE la.classroom_id = $1 AND la.status = 'ACTIVE'
       LIMIT 1`,
      [classroom_id]
    );

    if (result.rows.length === 0) {
      return res.json({ active: false, activity: null });
    }

    const row = result.rows[0];

    let quizDetails = null;
    let currentQuestion = null;

    if (row.activity_type === 'QUIZ') {
      const questions = await loadQuizQuestions(row);

      // Sanitize: never expose correct_option_id before reveal.
      quizDetails = {
        title: row.quiz_title,
        scoring_mode: row.quiz_scoring_mode,
        question_count: questions.length,
        questions: questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          options: q.options,
          order_index: q.order_index,
          time_limit_seconds: q.time_limit_seconds,
        })),
      };

      // Durable state survives a server restart.
      const state = await getLatestQuestionState(row.id);
      if (state) {
        const nowMs = Date.now();
        const endsAtMs = Number(state.ends_at_ms);
        const revealed = state.revealed === true;

        // A question is "live" while its timer runs, or after results are revealed.
        if (revealed || nowMs <= endsAtMs) {
          const question = questions.find((q) => q.id === state.question_id);
          currentQuestion = {
            question_id: state.question_id,
            question_index: question ? question.order_index : null,
            start_time_ms: Number(state.started_at_ms),
            end_time_ms: endsAtMs,
            revealed,
          };
          if (revealed) {
            currentQuestion.correct_option_id = question ? question.correct_option_id : null;
          }
        }
      }
    }

    let userResponse = null;
    let userAnswers = null;
    let scoreSoFar = null;

    if (req.user && req.user.role === 'student') {
      if (row.activity_type === 'PULSEMETER') {
        const pmResp = await db.query(
          `SELECT response_value FROM pulsemeter_responses WHERE live_activity_id = $1 AND student_id = $2`,
          [row.id, req.user.id]
        );
        userResponse = {
          has_responded: pmResp.rows.length > 0,
          response_value: pmResp.rows[0]?.response_value || null,
        };
        userAnswers = [];
        scoreSoFar = 0;
      } else if (row.activity_type === 'QUIZ') {
        const qResp = await db.query(
          `SELECT question_id, selected_option_id, is_correct, score_awarded
           FROM quiz_responses
           WHERE live_activity_id = $1 AND student_id = $2`,
          [row.id, req.user.id]
        );
        const answeredQuestions = qResp.rows.map((r) => ({
          question_id: r.question_id,
          selected_option_id: r.selected_option_id,
          is_correct: r.is_correct,
          score_awarded: r.score_awarded,
        }));
        const totalScore = qResp.rows.reduce((sum, r) => sum + (r.score_awarded || 0), 0);
        userResponse = {
          has_responded: answeredQuestions.length > 0,
          answered_count: answeredQuestions.length,
          answered_questions: answeredQuestions,
          cumulative_score: totalScore,
        };
        userAnswers = answeredQuestions;
        scoreSoFar = totalScore;
      }
    }

    const activityPayload = {
      id: row.id,
      classroom_id: row.classroom_id,
      activity_type: row.activity_type,
      activity_ref_id: row.activity_ref_id,
      status: row.status,
      started_at: row.started_at,
      pulsemeter: row.pm_title ? {
        title: row.pm_title,
        type: row.pm_type,
        config: row.pm_config,
      } : null,
      quiz: quizDetails,
      current_question: currentQuestion,
      user_response: userResponse,
    };

    const response = {
      active: true,
      activity: activityPayload,
    };

    if (req.user && req.user.role === 'student') {
      activityPayload.user_answers = userAnswers || [];
      activityPayload.score_so_far = scoreSoFar || 0;
      response.user_answers = userAnswers || [];
      response.score_so_far = scoreSoFar || 0;
    }

    res.json(response);
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error checking active activity:', err);
    res.status(500).json({ error: 'Failed to check active activity' });
  }
});

/**
 * POST /live-activities/:id/quiz/start-question
 * Role: Teacher
 * Start a specific quiz question with server-authoritative countdown.
 * Durable state lives in activity_question_states (survives restarts).
 */
router.post('/:id/quiz/start-question', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id, question_index } = req.body;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const hasQuestionId = question_id !== undefined && question_id !== null;

    if (hasQuestionId && !isUuid(question_id)) {
      return res.status(400).json({ error: 'Invalid question_id' });
    }

    if (question_index !== undefined && question_index !== null) {
      if (!Number.isInteger(question_index) || question_index < 0) {
        return res.status(400).json({ error: 'question_index must be a non-negative integer' });
      }
    }

    // Verify activity is an active QUIZ owned by the teacher
    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Quiz activity is no longer active' });
    }

    // Fetch the question
    let question;
    if (hasQuestionId) {
      const qRes = await db.query(
        'SELECT * FROM quiz_questions WHERE id = $1 AND quiz_id = $2',
        [question_id, activity.activity_ref_id]
      );
      if (qRes.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
      question = qRes.rows[0];
    } else {
      const idx = question_index ?? 0;
      const qRes = await db.query(
        'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY order_index ASC LIMIT 1 OFFSET $2',
        [activity.activity_ref_id, idx]
      );
      if (qRes.rows.length === 0) return res.status(404).json({ error: 'Question index out of bounds' });
      question = qRes.rows[0];
    }

    // Do not reopen a question whose results were already revealed.
    const existingState = await getQuestionState(activityId, question.id);
    if (existingState && existingState.revealed === true) {
      return res.status(409).json({ error: 'Results for this question are already shown.' });
    }

    const startTimeMs = Date.now();
    const timeLimitSeconds = question.time_limit_seconds || 20;
    const endTimeMs = startTimeMs + (timeLimitSeconds * 1000);

    // Durable upsert: restarting an un-revealed question refreshes its timer.
    await db.query(
      `INSERT INTO activity_question_states
         (live_activity_id, question_id, started_at_ms, ends_at_ms, revealed)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (live_activity_id, question_id)
       DO UPDATE SET started_at_ms = EXCLUDED.started_at_ms,
                     ends_at_ms = EXCLUDED.ends_at_ms,
                     revealed = FALSE`,
      [activityId, question.id, startTimeMs, endTimeMs]
    );

    // Broadcast question to all students in the classroom without revealing correct_option_id
    const io = req.app.get('io');
    if (io) {
      io.to(`classroom_${activity.classroom_id}`).emit('quiz:question_start', {
        activityId,
        questionIndex: question.order_index,
        question: {
          id: question.id,
          question_text: question.question_text,
          options: question.options,
          time_limit_seconds: timeLimitSeconds,
          order_index: question.order_index,
        },
        startTimeMs,
        endTimeMs,
      });
    }

    res.json({
      message: 'Question started successfully',
      questionId: question.id,
      questionIndex: question.order_index,
      startTimeMs,
      endTimeMs,
      timeLimitSeconds,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error starting question:', err);
    res.status(500).json({ error: 'Failed to start question' });
  }
});

/**
 * POST /live-activities/:id/quiz/answer
 * Role: Student
 * Submit an answer to the currently active quiz question.
 * Applies time-weighted scoring formula (Section 4a) using server-clock measurement.
 */
router.post('/:id/quiz/answer', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id, selected_option_id } = req.body;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit quiz answers' });
    }

    if (!question_id || !selected_option_id) {
      return res.status(400).json({ error: 'question_id and selected_option_id are required' });
    }

    if (!isUuid(question_id)) {
      return res.status(400).json({ error: 'Invalid question_id' });
    }

    // Verify activity is ACTIVE. Snapshot scoring mode keeps deleted templates working.
    const activityCheck = await db.query(
      `SELECT la.*,
              COALESCE(q.scoring_mode, la.config_snapshot->>'scoring_mode') as scoring_mode
       FROM live_activities la
       LEFT JOIN quizzes q ON la.activity_type = 'QUIZ' AND la.activity_ref_id = q.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Quiz is no longer active' });
    }

    // Verify student is enrolled
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [activity.classroom_id, req.user.id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom' });
    }

    // Fetch question to validate the option and the correct answer
    const questionCheck = await db.query(
      'SELECT * FROM quiz_questions WHERE id = $1 AND quiz_id = $2',
      [question_id, activity.activity_ref_id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = questionCheck.rows[0];

    // Validate the submitted option against the question's options.
    const cleanSelected = String(selected_option_id).toLowerCase().trim();
    const options = Array.isArray(question.options) ? question.options : [];
    const optionIds = options.map((o) => String(o.id).toLowerCase());
    if (!optionIds.includes(cleanSelected)) {
      return res.status(400).json({ error: 'Invalid option for this question.' });
    }

    // Read the timer from durable state. No state => the question is not open.
    const state = await getQuestionState(activityId, question_id);
    if (!state || state.revealed === true) {
      return res.status(409).json({ error: 'This question is not currently open for answers.' });
    }

    // Only the single most recently started question can accept answers.
    const latestState = await getLatestQuestionState(activityId);
    if (!latestState || latestState.question_id !== question_id) {
      return res.status(409).json({ error: 'This question is not currently open for answers.' });
    }

    const nowMs = Date.now();
    const startTimeMs = Number(state.started_at_ms);
    const endTimeMs = Number(state.ends_at_ms);

    if (nowMs > endTimeMs) {
      return res.status(400).json({ error: 'Time limit for this question has expired.' });
    }

    const timeLimit = Math.max(1, (endTimeMs - startTimeMs) / 1000);
    const responseTimeMs = Math.max(0, nowMs - startTimeMs);
    const responseTimeSeconds = responseTimeMs / 1000;

    const cleanCorrect = String(question.correct_option_id).toLowerCase().trim();
    const isCorrect = cleanSelected === cleanCorrect;

    // Section 4a Scoring Formula
    // Fraction remaining f = max(0, min(1, (T - response_time_seconds) / T))
    let scoreAwarded = 0;
    if (isCorrect) {
      const f = Math.max(0, Math.min(1, (timeLimit - responseTimeSeconds) / timeLimit));
      if (activity.scoring_mode === 'NARROW') {
        // NARROW mode: 700 + 300 * f
        scoreAwarded = Math.round(700 + 300 * f);
      } else {
        // WIDE mode (Default): 300 + 700 * f
        scoreAwarded = Math.round(300 + 700 * f);
      }
    }

    // Insert response into quiz_responses table
    try {
      await db.query(
        `INSERT INTO quiz_responses (live_activity_id, question_id, student_id, selected_option_id, is_correct, response_time_ms, score_awarded)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [activityId, question_id, req.user.id, cleanSelected, isCorrect, responseTimeMs, scoreAwarded]
      );
    } catch (insertErr) {
      if (insertErr.constraint === 'quiz_responses_live_activity_id_question_id_student_id_key') {
        return res.status(409).json({ error: 'You have already submitted an answer for this question' });
      }
      throw insertErr;
    }

    // Get live response count for this question
    const countRes = await db.query(
      'SELECT COUNT(*)::int as total FROM quiz_responses WHERE live_activity_id = $1 AND question_id = $2',
      [activityId, question_id]
    );

    // Emit live answer tick to teacher room
    const io = req.app.get('io');
    if (io) {
      io.to(`activity_${activityId}_teacher`).emit('quiz:live_answers', {
        activityId,
        questionId: question_id,
        answeredCount: countRes.rows[0].total,
      });
    }

    // Never leak correct_option_id here; it is only exposed after reveal.
    res.status(201).json({
      message: 'Answer submitted successfully',
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
      response_time_ms: responseTimeMs,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error submitting answer:', err);
    res.status(500).json({ error: 'Failed to submit quiz answer' });
  }
});

/**
 * POST /live-activities/:id/quiz/show-results
 * Role: Teacher
 * Reveals answer, broadcasts option distribution, and sends updated cumulative leaderboard.
 */
router.post('/:id/quiz/show-results', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id } = req.body;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    if (!question_id || !isUuid(question_id)) {
      return res.status(400).json({ error: 'Invalid question_id' });
    }

    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Quiz activity is no longer active' });
    }

    // The question must belong to this quiz.
    const qCheck = await db.query(
      'SELECT * FROM quiz_questions WHERE id = $1 AND quiz_id = $2',
      [question_id, activity.activity_ref_id]
    );
    if (qCheck.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    const question = qCheck.rows[0];

    // Compute distribution for this question
    const distRes = await db.query(
      `SELECT selected_option_id, COUNT(*)::int as count
       FROM quiz_responses
       WHERE live_activity_id = $1 AND question_id = $2
       GROUP BY selected_option_id`,
      [activityId, question_id]
    );

    const options = question.options || [];
    const distribution = options.map((opt) => ({
      option_id: opt.id,
      option_text: opt.text,
      count: distRes.rows.find((r) => r.selected_option_id === opt.id)?.count || 0,
      is_correct: opt.id === question.correct_option_id,
    }));

    // Compute cumulative leaderboard
    const leaderboard = await computeQuizLeaderboard(activityId);

    // Mark question as revealed so late submissions are rejected.
    await db.query(
      `UPDATE activity_question_states
       SET revealed = TRUE
       WHERE live_activity_id = $1 AND question_id = $2`,
      [activityId, question_id]
    );

    // Broadcast question results and leaderboard to classroom
    const io = req.app.get('io');
    if (io) {
      io.to(`classroom_${activity.classroom_id}`).emit('quiz:question_results', {
        activityId,
        questionId: question_id,
        correct_option_id: question.correct_option_id,
        distribution,
        leaderboard,
      });
    }

    res.json({
      questionId: question_id,
      correct_option_id: question.correct_option_id,
      distribution,
      leaderboard,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error showing results:', err);
    res.status(500).json({ error: 'Failed to show results' });
  }
});

/**
 * GET /live-activities/:id/quiz/leaderboard
 * Role: Classroom teacher or an enrolled student
 * Retrieve the current cumulative leaderboard for a live quiz.
 */
router.get('/:id/quiz/leaderboard', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const activity = await getQuizActivity(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    let isTeacher = false;
    if (req.user.role === 'teacher') {
      if (activity.teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      isTeacher = true;
    } else if (req.user.role === 'student') {
      const enrollment = await db.query(
        'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
        [activity.classroom_id, req.user.id]
      );
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this classroom' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let leaderboard = await computeQuizLeaderboard(activityId);

    // Students never see other students' email addresses.
    if (!isTeacher) {
      leaderboard = leaderboard.map(({ student_email, ...rest }) => rest);
    }

    res.json({ activityId, leaderboard });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * POST /live-activities/:id/quiz/end
 * Role: Teacher
 * Conclude the live quiz session, finalize leaderboard, and broadcast quiz:ended.
 */
router.post('/:id/quiz/end', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id, c.id as cid
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (activity.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Quiz already ended.' });
    }

    // End activity
    const endRes = await db.query(
      `UPDATE live_activities
       SET status = 'ENDED', ended_at = now()
       WHERE id = $1
       RETURNING *`,
      [activityId]
    );

    const finalLeaderboard = await computeQuizLeaderboard(activityId);
    const podium = finalLeaderboard.slice(0, 3);

    // Broadcast quiz:ended to classroom
    const io = req.app.get('io');
    if (io) {
      io.to(`classroom_${activity.classroom_id}`).emit('quiz:ended', {
        activityId,
        finalLeaderboard,
        podium,
      });
    }

    res.json({
      message: 'Quiz session concluded successfully',
      activity: endRes.rows[0],
      finalLeaderboard,
      podium,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error ending quiz:', err);
    res.status(500).json({ error: 'Failed to end quiz session' });
  }
});

/**
 * GET /live-activities/:id/quiz/results
 * Role: Teacher (classroom owner)
 * Full per-question distribution and per-student answer breakdown for a run.
 */
router.get('/:id/quiz/results', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const activity = await getQuizActivity(activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const questions = await loadQuizQuestions(activity);

    const responsesRes = await db.query(
      `SELECT question_id, student_id, selected_option_id, is_correct,
              response_time_ms, score_awarded, answered_at
       FROM quiz_responses
       WHERE live_activity_id = $1`,
      [activityId]
    );

    const enrollRes = await db.query(
      `SELECT u.id AS student_id, u.full_name AS student_name, u.email AS student_email
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       WHERE e.classroom_id = $1`,
      [activity.classroom_id]
    );

    const responses = responsesRes.rows;
    const responsesByStudent = new Map();
    const totalsByStudent = new Map();

    for (const r of responses) {
      if (!responsesByStudent.has(r.student_id)) responsesByStudent.set(r.student_id, []);
      responsesByStudent.get(r.student_id).push(r);

      totalsByStudent.set(
        r.student_id,
        (totalsByStudent.get(r.student_id) || 0) + (r.score_awarded || 0)
      );
    }

    const questionOrder = new Map(questions.map((q, idx) => [q.id, idx]));

    const questionResults = questions.map((q) => {
      const questionResponses = responses.filter((r) => r.question_id === q.id);
      const responseCount = questionResponses.length;
      const correctCount = questionResponses.filter((r) => r.is_correct).length;
      const options = Array.isArray(q.options) ? q.options : [];

      const distribution = options.map((opt) => {
        const count = questionResponses.filter(
          (r) => String(r.selected_option_id).toLowerCase() === String(opt.id).toLowerCase()
        ).length;
        return {
          option_id: opt.id,
          option_text: opt.text,
          count,
          pct: percent(count, responseCount),
          is_correct: opt.id === q.correct_option_id,
        };
      });

      return {
        question_id: q.id,
        order_index: q.order_index,
        question_text: q.question_text,
        options: options.map((o) => ({ id: o.id, text: o.text })),
        correct_option_id: q.correct_option_id,
        time_limit_seconds: q.time_limit_seconds,
        response_count: responseCount,
        correct_count: correctCount,
        pct_correct: percent(correctCount, responseCount),
        distribution,
      };
    });

    const students = enrollRes.rows.map((s) => {
      const answers = (responsesByStudent.get(s.student_id) || [])
        .slice()
        .sort(
          (a, b) =>
            (questionOrder.get(a.question_id) ?? Number.MAX_SAFE_INTEGER) -
            (questionOrder.get(b.question_id) ?? Number.MAX_SAFE_INTEGER)
        )
        .map((r) => ({
          question_id: r.question_id,
          selected_option_id: r.selected_option_id,
          is_correct: r.is_correct,
          response_time_ms: r.response_time_ms,
          score_awarded: r.score_awarded,
          answered_at: r.answered_at,
        }));

      const totalScore = answers.reduce((sum, a) => sum + (a.score_awarded || 0), 0);
      const correctCount = answers.filter((a) => a.is_correct).length;
      const avgResponseTime = answers.length
        ? Math.round(answers.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / answers.length)
        : 0;

      return {
        student_id: s.student_id,
        student_name: s.student_name,
        student_email: s.student_email,
        rank: 0,
        total_score: totalScore,
        correct_count: correctCount,
        answered_count: answers.length,
        avg_response_time_ms: avgResponseTime,
        answers,
      };
    });

    students.sort(
      (a, b) => b.total_score - a.total_score || a.student_name.localeCompare(b.student_name)
    );
    students.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    let totalScoreSum = 0;
    for (const total of totalsByStudent.values()) totalScoreSum += total;
    const avgScore = totalsByStudent.size > 0
      ? round1(totalScoreSum / totalsByStudent.size)
      : null;

    res.json({
      session: {
        id: activity.id,
        quiz_id: activity.activity_ref_id,
        title: activity.resolved_title,
        scoring_mode: activity.resolved_scoring_mode,
        status: activity.status,
        started_at: activity.started_at,
        ended_at: activity.ended_at,
        question_count: questions.length,
        participant_count: totalsByStudent.size,
        total_responses: responses.length,
        avg_score: avgScore,
      },
      questions: questionResults,
      students,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error fetching quiz results:', err);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

/**
 * GET /live-activities/:id/quiz/state
 * Role: Teacher (classroom owner)
 * Returns the durable live-quiz state so the web UI can resume after a reload
 * without restarting the quiz or re-broadcasting questions.
 */
router.get('/:id/quiz/state', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    const activity = await getQuizActivity(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const questions = await loadQuizQuestions(activity);
    const latestState = await getLatestQuestionState(activityId);

    let stage = 'LOBBY';
    let currentQuestion = null;

    if (activity.status === 'ENDED') {
      stage = 'FINAL_LEADERBOARD';
    } else if (latestState) {
      const nowMs = Date.now();
      const revealed = latestState.revealed === true;
      const endsAtMs = Number(latestState.ends_at_ms);
      const question = questions.find((q) => q.id === latestState.question_id);

      if (revealed) {
        stage = 'QUESTION_RESULTS';
      } else {
        // A question whose timer ran out but has not been revealed is still
        // "active" from the teacher's perspective: the UI must not show the
        // answer key until the teacher explicitly reveals it.
        stage = 'QUESTION_ACTIVE';
      }

      currentQuestion = {
        question_id: latestState.question_id,
        question_index: question ? question.order_index : null,
        question_text: question ? question.question_text : null,
        options: question && Array.isArray(question.options) ? question.options : [],
        start_time_ms: Number(latestState.started_at_ms),
        end_time_ms: endsAtMs,
        time_expired: nowMs > endsAtMs,
        revealed,
        correct_option_id: revealed && question ? question.correct_option_id : null,
      };
    }

    let answeredCount = 0;
    if (latestState) {
      const answeredRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM quiz_responses
         WHERE live_activity_id = $1 AND question_id = $2`,
        [activityId, latestState.question_id]
      );
      answeredCount = answeredRes.rows[0] ? answeredRes.rows[0].total : 0;
    }

    const leaderboard = await computeQuizLeaderboard(activityId);

    res.json({
      activityId: activity.id,
      title: activity.resolved_title,
      scoring_mode: activity.resolved_scoring_mode,
      status: activity.status,
      question_count: questions.length,
      stage,
      current_question: currentQuestion,
      answered_count: answeredCount,
      leaderboard,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error fetching quiz state:', err);
    res.status(500).json({ error: 'Failed to fetch quiz state' });
  }
});

/**
 * GET /live-activities/:id/quiz/my-results
 * Role: Student (enrolled)
 * A student's own answers, score, and rank for a quiz run.
 */
router.get('/:id/quiz/my-results', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!isUuid(activityId)) {
      return res.status(400).json({ error: 'Invalid live activity id' });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can view their quiz results' });
    }

    const activity = await getQuizActivity(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const enrollment = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [activity.classroom_id, req.user.id]
    );

    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom' });
    }

    const questions = await loadQuizQuestions(activity);

    // Correct answers are only exposed once the teacher has revealed the
    // question. Unrevealed questions must not leak the correct_option_id.
    const stateRes = await db.query(
      `SELECT question_id, revealed
       FROM activity_question_states
       WHERE live_activity_id = $1`,
      [activityId]
    );
    const revealedByQuestion = new Map(
      stateRes.rows.map((state) => [state.question_id, state.revealed === true])
    );

    const respRes = await db.query(
      `SELECT question_id, selected_option_id, is_correct, score_awarded
       FROM quiz_responses
       WHERE live_activity_id = $1 AND student_id = $2`,
      [activityId, req.user.id]
    );

    const myAnswers = new Map(respRes.rows.map((r) => [r.question_id, r]));

    const score = respRes.rows.reduce((sum, r) => sum + (r.score_awarded || 0), 0);
    const correctCount = respRes.rows.filter((r) => r.is_correct).length;
    const answeredCount = respRes.rows.length;

    const rankingRes = await db.query(
      `SELECT qr.student_id, u.full_name, SUM(qr.score_awarded)::int AS total
       FROM quiz_responses qr
       JOIN users u ON qr.student_id = u.id
       WHERE qr.live_activity_id = $1
       GROUP BY qr.student_id, u.full_name
       ORDER BY total DESC, u.full_name ASC`,
      [activityId]
    );

    const participants = rankingRes.rows.length;
    const rankIndex = rankingRes.rows.findIndex((r) => r.student_id === req.user.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    res.json({
      activity_id: activity.id,
      title: activity.resolved_title,
      status: activity.status,
      score,
      correct_count: correctCount,
      answered_count: answeredCount,
      total_questions: questions.length,
      rank,
      participants,
      questions: questions.map((q) => {
        const mine = myAnswers.get(q.id);
        const revealed = revealedByQuestion.get(q.id) === true;
        return {
          question_id: q.id,
          question_text: q.question_text,
          selected_option_id: mine ? mine.selected_option_id : null,
          correct_option_id: revealed ? q.correct_option_id : null,
          is_correct: mine ? mine.is_correct : false,
          score_awarded: mine ? mine.score_awarded : 0,
        };
      }),
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error fetching student quiz results:', err);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

/**
 * Helper: Compute cumulative leaderboard for a quiz activity.
 */
async function computeQuizLeaderboard(activityId) {
  const result = await db.query(
    `SELECT qr.student_id,
            u.full_name as student_name,
            u.email as student_email,
            SUM(qr.score_awarded)::int as total_score,
            COUNT(CASE WHEN qr.is_correct THEN 1 END)::int as correct_count,
            COUNT(qr.id)::int as total_answered,
            ROUND(AVG(qr.response_time_ms))::int as avg_response_time_ms
     FROM quiz_responses qr
     JOIN users u ON qr.student_id = u.id
     WHERE qr.live_activity_id = $1
     GROUP BY qr.student_id, u.full_name, u.email
     ORDER BY total_score DESC, avg_response_time_ms ASC`,
    [activityId]
  );

  return result.rows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}

/**
 * Helper: Compute aggregated PulseMeter results for charts.
 */
async function computeAggregatedResults(activityId, activity) {
  // Response counts: total rows and visible (non-blocked) rows
  const countResult = await db.query(
    `SELECT COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE is_blocked = false)::int as visible,
            COUNT(*) FILTER (WHERE is_blocked = true)::int as blocked
     FROM pulsemeter_responses
     WHERE live_activity_id = $1`,
    [activityId]
  );
  const responseCount = countResult.rows[0].total;
  const visibleResponseCount = countResult.rows[0].visible;
  const blockedCount = countResult.rows[0].blocked;

  // Present count from linked attendance session
  let presentCount = null;
  const attendancePending = activity.attendance_pending;

  if (activity.attendance_session_id) {
    const presentResult = await db.query(
      'SELECT COUNT(*)::int as total FROM attendance_records WHERE session_id = $1',
      [activity.attendance_session_id]
    );
    presentCount = presentResult.rows[0].total;
  }

  // Type-specific distribution
  let distribution = [];

  if (activity.pm_type === 'MCQ') {
    // Count per option
    const distResult = await db.query(
      `SELECT response_value as option_id, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1
       GROUP BY response_value
       ORDER BY response_value`,
      [activityId]
    );

    const options = activity.pm_config.options || [];
    distribution = options.map((opt) => ({
      option_id: opt.id,
      option_text: opt.text,
      count: distResult.rows.find((r) => r.option_id === opt.id)?.count || 0,
    }));
  } else if (activity.pm_type === 'RATING_SCALE') {
    // Count per rating value
    const min = activity.pm_config.min || 1;
    const max = activity.pm_config.max || 5;

    const distResult = await db.query(
      `SELECT response_value as rating, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1
       GROUP BY response_value`,
      [activityId]
    );

    for (let i = min; i <= max; i++) {
      distribution.push({
        rating: i,
        count: distResult.rows.find((r) => String(r.rating) === String(i))?.count || 0,
      });
    }
  } else if (activity.pm_type === 'WORD_CLOUD') {
    // Count per word for approved/unblocked responses, sorted by frequency
    const distResult = await db.query(
      `SELECT LOWER(TRIM(response_value)) as word, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1 AND is_blocked = false
       GROUP BY LOWER(TRIM(response_value))
       ORDER BY count DESC, word ASC
       LIMIT 100`,
      [activityId]
    );
    distribution = distResult.rows;
  }

  return {
    responseCount,
    visibleResponseCount,
    presentCount,
    attendancePending,
    distribution,
    blockedCount,
  };
}

module.exports = router;
