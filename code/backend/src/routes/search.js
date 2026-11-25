const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { canAccessClassroom, isCourseMember } = require('../utils/access');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.SEARCH_RATE_LIMIT_MAX) || 60,
  message: 'Too many requests. Please try again later.',
});

function buildAccessPredicate(userIdParam, role) {
  if (role === 'teacher') {
    return `(
      dp.audience_scope = 'APP'
      OR (dp.audience_scope = 'CLASSROOM' AND dp.classroom_id IN (
        SELECT id FROM classrooms WHERE teacher_id = ${userIdParam}
      ))
      OR (dp.audience_scope = 'COURSE' AND dp.course_id IN (
        SELECT course_id FROM classrooms WHERE teacher_id = ${userIdParam}
      ))
    )`;
  }

  return `(
    dp.audience_scope = 'APP'
    OR (dp.audience_scope = 'CLASSROOM' AND dp.classroom_id IN (
      SELECT classroom_id FROM enrollments WHERE student_id = ${userIdParam}
    ))
    OR (dp.audience_scope = 'COURSE' AND dp.course_id IN (
      SELECT c.course_id
      FROM enrollments e
      JOIN classrooms c ON e.classroom_id = c.id
      WHERE e.student_id = ${userIdParam}
    ))
  )`;
}

/**
 * GET /search
 * Audience-Scoped Full-Text Search across doubt questions and discussion content.
 * Powered by PostgreSQL tsvector GIN indexing, ts_rank relevance scoring, and ts_headline highlighting.
 */
router.get('/', searchRateLimit, authenticateToken, async (req, res) => {
  try {
    const {
      q,
      course_id,
      classroom_id,
      scope,
      topic_id,
      status,
      limit = 20,
      offset = 0,
    } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query parameter "q" is required.' });
    }

    for (const [name, value] of [['course_id', course_id], ['classroom_id', classroom_id], ['topic_id', topic_id]]) {
      if (value !== undefined && !isUuid(value)) {
        return res.status(400).json({ error: `${name} must be a valid UUID` });
      }
    }

    const parsedLimit = Number.parseInt(limit, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 100' });
    }

    const parsedOffset = Number.parseInt(offset, 10);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ error: 'offset must be an integer greater than or equal to 0' });
    }

    // Explicit membership checks give a clear 403 instead of silently returning
    // an empty result set for courses/classrooms the requester cannot access.
    if (course_id) {
      const isMember = await isCourseMember(req.user, course_id);
      if (!isMember) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this course' });
      }
    }

    if (classroom_id) {
      const canAccess = await canAccessClassroom(req.user, classroom_id);
      if (!canAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this classroom' });
      }
    }

    const cleanQuery = q.trim();
    const ilikePattern = `%${cleanQuery}%`;

    let conditions = [];
    let params = [cleanQuery, ilikePattern];
    let paramIdx = 3;

    // Full-text match condition with ILIKE fallback for partial words
    conditions.push(`(
      dp.search_vector @@ plainto_tsquery('english', $1)
      OR dp.title ILIKE $2
      OR dp.body ILIKE $2
      OR dp.pseudonym ILIKE $2
      OR ct.name ILIKE $2
      OR c.course_code ILIKE $2
      OR c.course_name ILIKE $2
    )`);

    // Course filter is applied whenever supplied, even in classroom context.
    if (course_id) {
      conditions.push(`dp.course_id = $${paramIdx}`);
      params.push(course_id);
      paramIdx++;
    }

    // Audience Scope / classroom filtering
    if (scope === 'APP') {
      conditions.push(`dp.audience_scope = 'APP'`);
    } else if (scope === 'COURSE') {
      conditions.push(`dp.audience_scope IN ('APP', 'COURSE')`);
    } else if (scope === 'CLASSROOM' && classroom_id) {
      conditions.push(`(dp.classroom_id = $${paramIdx} OR (dp.course_id = (SELECT course_id FROM classrooms WHERE id = $${paramIdx}) AND dp.audience_scope IN ('APP', 'COURSE')))`);
      params.push(classroom_id);
      paramIdx++;
    } else if (classroom_id) {
      // Default view in classroom context
      conditions.push(`(dp.classroom_id = $${paramIdx} OR dp.audience_scope IN ('APP', 'COURSE'))`);
      params.push(classroom_id);
      paramIdx++;
    }

    // Topic Filter
    if (topic_id) {
      conditions.push(`dp.topic_id = $${paramIdx}`);
      params.push(topic_id);
      paramIdx++;
    }

    // Status Filter
    if (status && status !== 'ALL') {
      conditions.push(`dp.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    // Current user: drives both the access predicate and the helpful-mark check.
    const currentUserIdParam = `$${paramIdx}`;
    params.push(req.user.id);
    paramIdx++;

    conditions.push(buildAccessPredicate(currentUserIdParam, req.user.role));

    const limitParam = `$${paramIdx}`;
    params.push(parsedLimit);
    paramIdx++;

    const offsetParam = `$${paramIdx}`;
    params.push(parsedOffset);

    const query = `
      SELECT dp.id, dp.course_id, dp.classroom_id, dp.topic_id, dp.author_id,
             dp.audience_scope, dp.title, dp.body, dp.is_anonymous, dp.pseudonym,
             dp.status, dp.helpful_count, dp.created_at, dp.updated_at,
             ct.name as topic_name,
             c.course_code, c.course_name,
             u.full_name as author_real_name,
             u.role as author_role,
             COUNT(dr.id)::int as reply_count,
             BOOL_OR(dr.is_solution) as has_accepted_solution,
             ts_rank(dp.search_vector, plainto_tsquery('english', $1)) as rank_score,
             ts_headline('english', dp.body, plainto_tsquery('english', $1), 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') as headline,
             COUNT(*) OVER()::int as total_count,
             EXISTS(
               SELECT 1 FROM doubt_helpful_marks dhm
               WHERE dhm.target_type = 'POST' AND dhm.target_id = dp.id AND dhm.user_id = ${currentUserIdParam}
             ) as user_has_marked_helpful
      FROM doubt_posts dp
      JOIN courses c ON dp.course_id = c.id
      JOIN users u ON dp.author_id = u.id
      LEFT JOIN course_topics ct ON dp.topic_id = ct.id
      LEFT JOIN doubt_replies dr ON dp.id = dr.doubt_post_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY dp.id, ct.name, c.course_code, c.course_name, u.full_name, u.role
      ORDER BY rank_score DESC, dp.helpful_count DESC, dp.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await db.query(query, params);

    const total = result.rows.length > 0 && result.rows[0].total_count !== undefined
      ? Number(result.rows[0].total_count)
      : result.rows.length;

    const results = result.rows.map((row) => {
      const { total_count, ...post } = row;
      const isAuthor = post.author_id === req.user.id;
      const isTeacher = req.user.role === 'teacher';
      const canSeeIdentity = isAuthor || isTeacher;

      return {
        ...post,
        author_display_name: post.is_anonymous
          ? (post.pseudonym || 'Anonymous Peer')
          : post.author_real_name,
        author_real_name: (!post.is_anonymous || canSeeIdentity) ? post.author_real_name : null,
        author_id: (!post.is_anonymous || canSeeIdentity) ? post.author_id : null,
      };
    });

    res.json({
      query: cleanQuery,
      total,
      results,
    });
  } catch (err) {
    console.error('[ClassPulse Search] Error executing full-text search:', err);
    res.status(500).json({ error: 'Search execution failed.' });
  }
});

module.exports = router;
