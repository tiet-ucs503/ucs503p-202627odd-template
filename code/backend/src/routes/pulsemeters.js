const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const parsedLinkWindow = parseInt(process.env.ATTENDANCE_LINK_WINDOW_HOURS || '12', 10);
const ATTENDANCE_LINK_WINDOW_HOURS =
  Number.isFinite(parsedLinkWindow) && parsedLinkWindow >= 0 ? parsedLinkWindow : 12;

/**
 * POST /pulsemeters
 * Role: Teacher
 * Author a reusable PulseMeter activity (Word Cloud, MCQ, or Rating Scale)
 */
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { classroom_id, title, type, config } = req.body;

    if (!classroom_id || !title || !type) {
      return res.status(400).json({ error: 'classroom_id, title, and type are required.' });
    }

    const validTypes = ['WORD_CLOUD', 'MCQ', 'RATING_SCALE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    // Verify teacher owns the classroom
    const classroomCheck = await db.query(
      'SELECT id, section_name FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroom_id, req.user.id]
    );

    if (classroomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Classroom not found or you do not have permission to author activities for it.' });
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'PulseMeter title cannot be empty.' });
    }

    let sanitizedConfig = config || {};

    // Validate type-specific configurations
    if (type === 'MCQ') {
      if (!sanitizedConfig.options || !Array.isArray(sanitizedConfig.options) || sanitizedConfig.options.length < 2) {
        return res.status(400).json({ error: 'MCQ PulseMeter requires at least 2 options.' });
      }

      const formattedOptions = sanitizedConfig.options.map((opt, idx) => {
        const text = typeof opt === 'string' ? opt.trim() : (opt.text || '').trim();
        const id = (opt && opt.id) ? opt.id : String.fromCharCode(97 + idx); // 'a', 'b', 'c'...
        return { id, text };
      });

      if (formattedOptions.some(opt => !opt.text)) {
        return res.status(400).json({ error: 'All MCQ options must have non-empty text.' });
      }

      sanitizedConfig = { options: formattedOptions };
    } else if (type === 'RATING_SCALE') {
      const min = parseInt(sanitizedConfig.min, 10) || 1;
      const max = parseInt(sanitizedConfig.max, 10) || 5;

      if (min >= max || min < 1 || max > 10) {
        return res.status(400).json({ error: 'Rating scale min must be >= 1 and max must be > min (up to 10).' });
      }

      sanitizedConfig = {
        min,
        max,
        low_label: sanitizedConfig.low_label ? sanitizedConfig.low_label.trim() : 'Lowest',
        high_label: sanitizedConfig.high_label ? sanitizedConfig.high_label.trim() : 'Highest',
      };
    } else if (type === 'WORD_CLOUD') {
      sanitizedConfig = {
        prompt: sanitizedConfig.prompt ? sanitizedConfig.prompt.trim() : trimmedTitle,
      };
    }

    const insertResult = await db.query(
      `INSERT INTO pulsemeters (classroom_id, created_by, title, type, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, classroom_id, created_by, title, type, config, created_at`,
      [classroom_id, req.user.id, trimmedTitle, type, JSON.stringify(sanitizedConfig)]
    );

    const pulsemeter = insertResult.rows[0];

    res.status(201).json({
      message: 'PulseMeter created successfully',
      pulsemeter,
    });
  } catch (err) {
    console.error('[ClassPulse PulseMeter] Error creating PulseMeter:', err);
    res.status(500).json({ error: 'Failed to create PulseMeter activity.' });
  }
});

/**
 * GET /pulsemeters?classroom_id=...
 * Role: Teacher
 * List reusable PulseMeters for a classroom
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

    const result = await db.query(
      `SELECT p.id, p.classroom_id, p.created_by, p.title, p.type, p.config, p.created_at,
              u.full_name as created_by_name
       FROM pulsemeters p
       JOIN users u ON p.created_by = u.id
       WHERE p.classroom_id = $1
       ORDER BY p.created_at DESC`,
      [classroom_id]
    );

    res.json({
      pulsemeters: result.rows,
    });
  } catch (err) {
    console.error('[ClassPulse PulseMeter] Error fetching PulseMeters:', err);
    res.status(500).json({ error: 'Failed to fetch PulseMeters.' });
  }
});

/**
 * POST /pulsemeters/:id/launch
 * Role: Teacher
 * Launch a reusable PulseMeter as the classroom's live activity.
 * Enforces one-active-activity-per-classroom via DB partial unique index.
 * Implements present-vs-responded resolution (Section 4b):
 *   - If a recent ENDED attendance session exists, links it immediately.
 *   - If not, sets attendance_pending = TRUE for later resolution.
 */
router.post('/:id/launch', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const pulseMeterId = req.params.id;

    // Fetch the PulseMeter and verify ownership
    const pmCheck = await db.query(
      `SELECT p.*, c.teacher_id, c.id as classroom_id_verified
       FROM pulsemeters p
       JOIN classrooms c ON p.classroom_id = c.id
       WHERE p.id = $1`,
      [pulseMeterId]
    );

    if (pmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PulseMeter not found' });
    }

    const pm = pmCheck.rows[0];

    if (pm.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    // Present-vs-responded resolution (Section 4b):
    // Look for the most recent ENDED attendance session in this classroom that
    // ended inside the linking window. A stale session must not silently
    // provide present/absent data for a brand-new activity.
    const recentSession = await db.query(
      `SELECT id FROM sessions
       WHERE classroom_id = $1 AND ended_at IS NOT NULL
         AND ended_at > now() - ($2 || ' hours')::interval
       ORDER BY started_at DESC
       LIMIT 1`,
      [pm.classroom_id, String(ATTENDANCE_LINK_WINDOW_HOURS)]
    );

    let attendanceSessionId = null;
    let attendancePending = false;

    if (recentSession.rows.length > 0) {
      // Default case: attendance already taken — link immediately
      attendanceSessionId = recentSession.rows[0].id;
    } else {
      // Pending case: no ended session exists yet
      attendancePending = true;
    }

    // Create the live activity (partial unique index enforces one-active-per-classroom)
    let liveActivity;
    try {
      const insertResult = await db.query(
        `INSERT INTO live_activities
           (classroom_id, activity_type, activity_ref_id, attendance_session_id, attendance_pending,
            title_snapshot, config_snapshot)
         VALUES ($1, 'PULSEMETER', $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          pm.classroom_id,
          pulseMeterId,
          attendanceSessionId,
          attendancePending,
          pm.title,
          JSON.stringify({ type: pm.type, config: pm.config }),
        ]
      );
      liveActivity = insertResult.rows[0];
    } catch (insertErr) {
      // Catch the partial unique index violation
      if (insertErr.constraint === 'one_active_activity_per_classroom') {
        return res.status(409).json({
          error: 'Another activity is already live in this classroom. End it before launching a new one.',
        });
      }
      throw insertErr;
    }

    // Emit activity:launched to the classroom via Socket.io
    const io = req.app.get('io');
    io.to(`classroom_${pm.classroom_id}`).emit('activity:launched', {
      activityId: liveActivity.id,
      activityType: 'PULSEMETER',
      pulsemeter: {
        id: pm.id,
        title: pm.title,
        type: pm.type,
        config: pm.config,
      },
    });

    res.status(201).json({
      message: 'PulseMeter launched successfully',
      activity: liveActivity,
      pulsemeter: {
        id: pm.id,
        title: pm.title,
        type: pm.type,
        config: pm.config,
      },
      attendancePending,
    });
  } catch (err) {
    console.error('[ClassPulse PulseMeter] Error launching PulseMeter:', err);
    res.status(500).json({ error: 'Failed to launch PulseMeter' });
  }
});

/**
 * PUT /pulsemeters/:id
 * Role: Teacher
 * Edit an authored PulseMeter (title, type, config)
 */
router.put('/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const pulseMeterId = req.params.id;
    const { title, type, config } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required.' });
    }

    const validTypes = ['WORD_CLOUD', 'MCQ', 'RATING_SCALE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const pmCheck = await db.query(
      `SELECT p.id, c.teacher_id 
       FROM pulsemeters p 
       JOIN classrooms c ON p.classroom_id = c.id 
       WHERE p.id = $1`,
      [pulseMeterId]
    );

    if (pmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PulseMeter not found.' });
    }

    if (pmCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this PulseMeter.' });
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'PulseMeter title cannot be empty.' });
    }

    let sanitizedConfig = config || {};

    if (type === 'MCQ') {
      if (!sanitizedConfig.options || !Array.isArray(sanitizedConfig.options) || sanitizedConfig.options.length < 2) {
        return res.status(400).json({ error: 'MCQ PulseMeter requires at least 2 options.' });
      }

      const formattedOptions = sanitizedConfig.options.map((opt, idx) => {
        const text = typeof opt === 'string' ? opt.trim() : (opt.text || '').trim();
        const id = (opt && opt.id) ? opt.id : String.fromCharCode(97 + idx);
        return { id, text };
      });

      if (formattedOptions.some(opt => !opt.text)) {
        return res.status(400).json({ error: 'All MCQ options must have non-empty text.' });
      }

      sanitizedConfig = { options: formattedOptions };
    } else if (type === 'RATING_SCALE') {
      const min = parseInt(sanitizedConfig.min, 10) || 1;
      const max = parseInt(sanitizedConfig.max, 10) || 5;

      if (min >= max || min < 1 || max > 10) {
        return res.status(400).json({ error: 'Rating scale min must be >= 1 and max must be > min (up to 10).' });
      }

      sanitizedConfig = {
        min,
        max,
        low_label: sanitizedConfig.low_label ? sanitizedConfig.low_label.trim() : 'Lowest',
        high_label: sanitizedConfig.high_label ? sanitizedConfig.high_label.trim() : 'Highest',
      };
    } else if (type === 'WORD_CLOUD') {
      sanitizedConfig = {
        prompt: sanitizedConfig.prompt ? sanitizedConfig.prompt.trim() : trimmedTitle,
      };
    }

    const updateResult = await db.query(
      `UPDATE pulsemeters
       SET title = $1, type = $2, config = $3
       WHERE id = $4
       RETURNING id, classroom_id, created_by, title, type, config, created_at`,
      [trimmedTitle, type, JSON.stringify(sanitizedConfig), pulseMeterId]
    );

    res.json({
      message: 'PulseMeter updated successfully',
      pulsemeter: updateResult.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse PulseMeter] Error updating PulseMeter:', err);
    res.status(500).json({ error: 'Failed to update PulseMeter activity.' });
  }
});

/**
 * DELETE /pulsemeters/:id
 * Role: Teacher
 * Delete an authored PulseMeter.
 */
router.delete('/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const pulseMeterId = req.params.id;

    const pmCheck = await db.query(
      `SELECT p.id, c.teacher_id 
       FROM pulsemeters p 
       JOIN classrooms c ON p.classroom_id = c.id 
       WHERE p.id = $1`,
      [pulseMeterId]
    );

    if (pmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PulseMeter not found.' });
    }

    if (pmCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this PulseMeter.' });
    }

    // Runs are historical records: refuse to delete a template that was launched.
    const historyCheck = await db.query(
      'SELECT 1 FROM live_activities WHERE activity_ref_id = $1 AND activity_type = $2 LIMIT 1',
      [pulseMeterId, 'PULSEMETER']
    );

    if (historyCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This PulseMeter has live-run history and cannot be deleted.' });
    }

    await db.query('DELETE FROM pulsemeters WHERE id = $1', [pulseMeterId]);

    res.json({ message: 'PulseMeter deleted successfully.' });
  } catch (err) {
    console.error('[ClassPulse PulseMeter] Error deleting PulseMeter:', err);
    res.status(500).json({ error: 'Failed to delete PulseMeter.' });
  }
});

module.exports = router;

