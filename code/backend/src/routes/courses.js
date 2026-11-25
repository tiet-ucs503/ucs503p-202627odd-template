const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /courses — Fetch list of predefined course codes (e.g. UCS503P, UCS405)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, course_code, course_name FROM courses ORDER BY course_code ASC'
    );
    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch course list' });
  }
});

module.exports = router;
