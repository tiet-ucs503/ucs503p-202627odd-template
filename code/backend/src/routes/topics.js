const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /courses/:course_id/topics
 * Retrieve all discussion topics defined for a course.
 */
router.get('/:course_id/topics', authenticateToken, async (req, res) => {
  try {
    const { course_id } = req.params;

    const courseCheck = await db.query('SELECT id FROM courses WHERE id = $1', [course_id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await db.query(
      `SELECT ct.id, ct.course_id, ct.name, ct.created_at,
              COUNT(dp.id)::int as post_count
       FROM course_topics ct
       LEFT JOIN doubt_posts dp ON ct.id = dp.topic_id
       WHERE ct.course_id = $1
       GROUP BY ct.id
       ORDER BY ct.name ASC`,
      [course_id]
    );

    res.json({ topics: result.rows });
  } catch (err) {
    console.error('[ClassPulse Topics] Error fetching topics:', err);
    res.status(500).json({ error: 'Failed to fetch course topics' });
  }
});

/**
 * POST /courses/:course_id/topics
 * Create a new topic for a course.
 */
router.post('/:course_id/topics', authenticateToken, async (req, res) => {
  try {
    const { course_id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    const cleanName = name.trim();

    if (cleanName.length > 100) {
      return res.status(400).json({ error: 'Topic name must be 100 characters or fewer' });
    }

    const courseCheck = await db.query('SELECT id FROM courses WHERE id = $1', [course_id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await db.query(
      `INSERT INTO course_topics (course_id, name)
       VALUES ($1, $2)
       ON CONFLICT (course_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [course_id, cleanName]
    );

    res.status(201).json({
      message: 'Topic created successfully',
      topic: result.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse Topics] Error creating topic:', err);
    res.status(500).json({ error: 'Failed to create course topic' });
  }
});

module.exports = router;
