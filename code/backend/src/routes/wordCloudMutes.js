const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /word-cloud-mutes
 * Role: Teacher
 * Mute a student from word-cloud participation in a classroom.
 * Duration must be one of: 7, 14, 30, 90, 180 days (confirmed in spec Section 2).
 */
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { student_id, classroom_id, reason, duration_days } = req.body;

    if (!student_id || !classroom_id || !duration_days) {
      return res.status(400).json({ error: 'student_id, classroom_id, and duration_days are required' });
    }

    const validDurations = [7, 14, 30, 90, 180];
    if (!validDurations.includes(Number(duration_days))) {
      return res.status(400).json({
        error: `duration_days must be one of: ${validDurations.join(', ')}`,
      });
    }

    // Verify teacher owns this classroom
    const classroomCheck = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this classroom' });
    }

    // Verify student is enrolled
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroom_id, student_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student is not enrolled in this classroom' });
    }

    // Cap the reason so it cannot be used to store unbounded text.
    const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : null;

    // Insert the mute (using interval arithmetic for muted_until)
    const result = await db.query(
      `INSERT INTO word_cloud_mutes (student_id, classroom_id, muted_by, reason, muted_until)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)
       RETURNING *`,
      [student_id, classroom_id, req.user.id, trimmedReason || null, String(duration_days)]
    );

    res.status(201).json({
      message: 'Student muted from word-cloud participation',
      mute: result.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse WordCloudMute] Error creating mute:', err);
    res.status(500).json({ error: 'Failed to mute student' });
  }
});

/**
 * GET /word-cloud-mutes?classroom_id=...
 * Role: Teacher
 * List active mutes for a classroom.
 */
router.get('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { classroom_id } = req.query;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id is required' });
    }

    const classroomCheck = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this classroom' });
    }

    const result = await db.query(
      `SELECT m.*, u.full_name as student_name, u.email as student_email
       FROM word_cloud_mutes m
       JOIN users u ON m.student_id = u.id
       WHERE m.classroom_id = $1 AND m.muted_until > now()
       ORDER BY m.created_at DESC`,
      [classroom_id]
    );

    res.json({ mutes: result.rows });
  } catch (err) {
    console.error('[ClassPulse WordCloudMute] Error fetching mutes:', err);
    res.status(500).json({ error: 'Failed to fetch mutes' });
  }
});

/**
 * DELETE /word-cloud-mutes?student_id=...&classroom_id=...
 * Role: Teacher
 * Unmute a student by classroom + student id (alternate to DELETE /:id).
 */
router.delete('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { student_id, classroom_id } = req.query;

    if (!student_id || !classroom_id) {
      return res.status(400).json({ error: 'student_id and classroom_id are required' });
    }

    const classroomCheck = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this classroom' });
    }

    const deleteRes = await db.query(
      'DELETE FROM word_cloud_mutes WHERE student_id = $1 AND classroom_id = $2',
      [student_id, classroom_id]
    );

    if (
      deleteRes.rowCount === 0 ||
      (deleteRes.rowCount === undefined &&
        Array.isArray(deleteRes.rows) &&
        deleteRes.rows.length === 0)
    ) {
      return res.status(404).json({ error: 'Mute not found' });
    }

    res.json({ message: 'Mute removed successfully' });
  } catch (err) {
    console.error('[ClassPulse WordCloudMute] Error removing mute for student:', err);
    res.status(500).json({ error: 'Failed to remove mute' });
  }
});

/**
 * DELETE /word-cloud-mutes/:id
 * Role: Teacher (classroom owner)
 * Remove a mute early.
 */
router.delete('/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const muteId = req.params.id;

    const muteCheck = await db.query(
      `SELECT m.id, m.classroom_id, c.teacher_id
       FROM word_cloud_mutes m
       JOIN classrooms c ON m.classroom_id = c.id
       WHERE m.id = $1`,
      [muteId]
    );

    if (muteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mute not found' });
    }

    if (muteCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this classroom' });
    }

    await db.query('DELETE FROM word_cloud_mutes WHERE id = $1', [muteId]);

    res.json({ message: 'Mute removed successfully' });
  } catch (err) {
    console.error('[ClassPulse WordCloudMute] Error removing mute:', err);
    res.status(500).json({ error: 'Failed to remove mute' });
  }
});

module.exports = router;
