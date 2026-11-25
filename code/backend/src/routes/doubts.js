const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getOrAssignPseudonym } = require('../utils/pseudonym');
const { checkProfanity } = require('../utils/profanityFilter');
const { resolveDoubtAccess, getClassroom, isEnrolled, isCourseMember } = require('../utils/access');

const MAX_TITLE_LENGTH = 255;
const MAX_BODY_LENGTH = 10000;

/**
 * SQL predicate that limits doubt posts to the ones the requester is allowed
 * to see. `userIdParam` is a positional parameter placeholder such as '$1'.
 */
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

async function fetchPostAccessRow(postId) {
  const result = await db.query(
    'SELECT id, author_id, course_id, classroom_id, audience_scope FROM doubt_posts WHERE id = $1',
    [postId]
  );
  return result.rows[0] || null;
}

async function fetchReplyAccessRow(replyId) {
  const result = await db.query(
    `SELECT dr.id, dr.doubt_post_id, dr.author_id, dr.is_solution,
            dp.author_id AS post_author_id, dp.course_id, dp.classroom_id, dp.audience_scope
     FROM doubt_replies dr
     JOIN doubt_posts dp ON dr.doubt_post_id = dp.id
     WHERE dr.id = $1`,
    [replyId]
  );
  return result.rows[0] || null;
}

/**
 * GET /doubts
 * List doubt posts filtered by audience scope, course, classroom, topic, and status.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      course_id,
      classroom_id,
      scope,
      topic_id,
      status,
      sort_by = 'recent',
      search,
    } = req.query;

    const currentUserIdParam = '$1';
    let params = [req.user.id];
    let paramIdx = 2;

    // The access predicate is always present and cannot be removed by client
    // supplied scope/course/classroom filters.
    let conditions = [buildAccessPredicate(currentUserIdParam, req.user.role)];

    // Scope & Audience filtering
    if (scope === 'APP') {
      conditions.push(`dp.audience_scope = 'APP'`);
    } else if (scope === 'COURSE' && course_id) {
      conditions.push(`dp.course_id = $${paramIdx}`);
      params.push(course_id);
      paramIdx++;
      conditions.push(`dp.audience_scope IN ('APP', 'COURSE')`);
    } else if (scope === 'CLASSROOM' && classroom_id) {
      conditions.push(`(dp.classroom_id = $${paramIdx} OR (dp.course_id = (SELECT course_id FROM classrooms WHERE id = $${paramIdx}) AND dp.audience_scope IN ('APP', 'COURSE')))`);
      params.push(classroom_id);
      paramIdx++;
      if (course_id) {
        conditions.push(`dp.course_id = $${paramIdx}`);
        params.push(course_id);
        paramIdx++;
      }
    } else if (classroom_id) {
      // Default classroom context view: show classroom + course + app scope
      conditions.push(`(dp.classroom_id = $${paramIdx} OR dp.audience_scope IN ('APP', 'COURSE'))`);
      params.push(classroom_id);
      paramIdx++;
      // Do not drop an explicitly requested course filter.
      if (course_id) {
        conditions.push(`dp.course_id = $${paramIdx}`);
        params.push(course_id);
        paramIdx++;
      }
    } else if (course_id) {
      conditions.push(`(dp.course_id = $${paramIdx} OR dp.audience_scope = 'APP')`);
      params.push(course_id);
      paramIdx++;
    }

    // Topic filter
    if (topic_id) {
      conditions.push(`dp.topic_id = $${paramIdx}`);
      params.push(topic_id);
      paramIdx++;
    }

    // Status filter
    if (status && status !== 'ALL') {
      conditions.push(`dp.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    // Search query filter (Case-insensitive title & body)
    if (search && search.trim().length > 0) {
      conditions.push(`(dp.title ILIKE $${paramIdx} OR dp.body ILIKE $${paramIdx})`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    // Pagination. The forum is bounded so a single request cannot scan the
    // entire table, while still returning a useful default page.
    const parsedLimit = req.query.limit === undefined ? 100 : Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 200' });
    }
    const parsedOffset = req.query.offset === undefined ? 0 : Number.parseInt(req.query.offset, 10);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ error: 'offset must be an integer greater than or equal to 0' });
    }

    const limitParam = `$${paramIdx}`;
    params.push(parsedLimit);
    paramIdx++;
    const offsetParam = `$${paramIdx}`;
    params.push(parsedOffset);

    // Sorting
    let orderBy = 'dp.created_at DESC';
    if (sort_by === 'helpful') {
      orderBy = 'dp.helpful_count DESC, dp.created_at DESC';
    } else if (sort_by === 'unanswered') {
      orderBy = 'reply_count ASC, dp.created_at DESC';
    }

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
      ORDER BY ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await db.query(query, params);

    // Apply anonymity masking for list responses. The access predicate already
    // guarantees a teacher only sees posts from classrooms/courses they teach.
    const posts = result.rows.map((post) => {
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

    res.json({ posts, limit: parsedLimit, offset: parsedOffset });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error fetching doubts:', err);
    res.status(500).json({ error: 'Failed to fetch doubt posts' });
  }
});

/**
 * POST /doubts
 * Create a new Doubt Post.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      course_id,
      classroom_id,
      topic_id,
      audience_scope = 'CLASSROOM',
      title,
      body,
      is_anonymous = false,
    } = req.body;

    if (!course_id || !title || !body) {
      return res.status(400).json({ error: 'course_id, title, and body are required' });
    }

    if (!['APP', 'COURSE', 'CLASSROOM'].includes(audience_scope)) {
      return res.status(400).json({ error: 'Invalid audience_scope. Must be APP, COURSE, or CLASSROOM.' });
    }

    if (typeof title !== 'string' || typeof body !== 'string') {
      return res.status(400).json({ error: 'Title and body must be strings' });
    }

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (cleanTitle.length === 0 || cleanTitle.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title must be between 1 and ${MAX_TITLE_LENGTH} characters` });
    }

    if (cleanBody.length === 0 || cleanBody.length > MAX_BODY_LENGTH) {
      return res.status(400).json({ error: `Body must be between 1 and ${MAX_BODY_LENGTH} characters` });
    }

    const profanity = checkProfanity(`${cleanTitle} ${cleanBody}`);
    if (profanity.isBlocked) {
      return res.status(400).json({
        error: 'Your post contains language that is not allowed in the doubt forum. Please revise it.',
      });
    }

    const courseRes = await db.query('SELECT id FROM courses WHERE id = $1', [course_id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (audience_scope === 'CLASSROOM') {
      if (!classroom_id) {
        return res.status(400).json({ error: 'classroom_id is required for CLASSROOM scope' });
      }
      const classroom = await getClassroom(classroom_id);
      if (!classroom) {
        return res.status(404).json({ error: 'Classroom not found' });
      }
      if (classroom.course_id !== course_id) {
        return res.status(400).json({ error: 'The selected classroom does not belong to this course' });
      }
      const canAccess = req.user.role === 'teacher'
        ? classroom.teacher_id === req.user.id
        : await isEnrolled(req.user.id, classroom_id);
      if (!canAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this classroom' });
      }
    } else if (audience_scope === 'COURSE') {
      const isMember = await isCourseMember(req.user, course_id);
      if (!isMember) {
        return res.status(403).json({ error: 'Forbidden: You are not a member of this course' });
      }
    }

    if (topic_id) {
      const topicRes = await db.query(
        'SELECT id FROM course_topics WHERE id = $1 AND course_id = $2',
        [topic_id, course_id]
      );
      if (topicRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid topic for the selected course' });
      }
    }

    const anonymous = is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1';

    let pseudonym = null;
    if (anonymous) {
      pseudonym = await getOrAssignPseudonym(req.user.id, course_id);
    }

    const insertResult = await db.query(
      `INSERT INTO doubt_posts (
         course_id, classroom_id, topic_id, author_id, audience_scope,
         title, body, is_anonymous, pseudonym
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        course_id,
        classroom_id || null,
        topic_id || null,
        req.user.id,
        audience_scope,
        cleanTitle,
        cleanBody,
        anonymous,
        pseudonym,
      ]
    );

    const post = insertResult.rows[0];

    res.status(201).json({
      message: 'Doubt post created successfully',
      post: {
        ...post,
        author_display_name: is_anonymous ? pseudonym : req.user.full_name || 'You',
      },
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error creating doubt post:', err);
    res.status(500).json({ error: 'Failed to create doubt post' });
  }
});

/**
 * GET /doubts/:id
 * Retrieve a specific Doubt Post with all discussion replies and solution status.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;

    // Fetch post
    const postRes = await db.query(
      `SELECT dp.*,
              ct.name as topic_name,
              c.course_code, c.course_name,
              u.full_name as author_real_name, u.role as author_role, u.email as author_email,
              EXISTS(
                SELECT 1 FROM doubt_helpful_marks dhm
                WHERE dhm.target_type = 'POST' AND dhm.target_id = dp.id AND dhm.user_id = $2
              ) as user_has_marked_helpful
       FROM doubt_posts dp
       JOIN courses c ON dp.course_id = c.id
       JOIN users u ON dp.author_id = u.id
       LEFT JOIN course_topics ct ON dp.topic_id = ct.id
       WHERE dp.id = $1`,
      [postId, req.user.id]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const post = postRes.rows[0];
    const access = await resolveDoubtAccess(req.user, post);

    if (!access.canView) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this doubt post' });
    }

    // Fetch replies
    const repliesRes = await db.query(
      `SELECT dr.*,
              u.full_name as author_real_name, u.role as author_role,
              EXISTS(
                SELECT 1 FROM doubt_helpful_marks dhm
                WHERE dhm.target_type = 'REPLY' AND dhm.target_id = dr.id AND dhm.user_id = $2
              ) as user_has_marked_helpful
       FROM doubt_replies dr
       JOIN users u ON dr.author_id = u.id
       WHERE dr.doubt_post_id = $1
       ORDER BY dr.is_solution DESC, dr.is_teacher_endorsed DESC, dr.helpful_count DESC, dr.created_at ASC`,
      [postId, req.user.id]
    );

    const canSeeIdentity = access.isAuthor || access.isTeacher;

    const replies = repliesRes.rows.map((r) => {
      const isReplyAuthor = r.author_id === req.user.id;
      const canSeeReplyIdentity = isReplyAuthor || access.isTeacher;

      return {
        ...r,
        author_display_name: r.is_anonymous
          ? (r.pseudonym || 'Anonymous Peer')
          : r.author_real_name,
        author_real_name: (!r.is_anonymous || canSeeReplyIdentity) ? r.author_real_name : null,
        author_id: (!r.is_anonymous || canSeeReplyIdentity) ? r.author_id : null,
      };
    });

    res.json({
      post: {
        ...post,
        author_display_name: post.is_anonymous
          ? (post.pseudonym || 'Anonymous Peer')
          : post.author_real_name,
        author_real_name: (!post.is_anonymous || canSeeIdentity) ? post.author_real_name : null,
        author_id: (!post.is_anonymous || canSeeIdentity) ? post.author_id : null,
        author_email: (!post.is_anonymous || canSeeIdentity) ? post.author_email : null,
      },
      replies,
      canRevealAuthor: Boolean(access.isTeacher && access.canModify),
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error fetching doubt details:', err);
    res.status(500).json({ error: 'Failed to fetch doubt details' });
  }
});

/**
 * POST /doubts/:id/replies
 * Add a reply/answer to a doubt post.
 */
router.post('/:id/replies', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { body, is_anonymous = false } = req.body;

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    if (body.trim().length > MAX_BODY_LENGTH) {
      return res.status(400).json({ error: `Reply body must be ${MAX_BODY_LENGTH} characters or fewer` });
    }

    const profanity = checkProfanity(body);
    if (profanity.isBlocked) {
      return res.status(400).json({
        error: 'Your reply contains language that is not allowed in the doubt forum. Please revise it.',
      });
    }

    const post = await fetchPostAccessRow(postId);
    if (!post) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const access = await resolveDoubtAccess(req.user, post);
    if (!access.canView) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this doubt post' });
    }

    let pseudonym = null;
    if (is_anonymous) {
      pseudonym = await getOrAssignPseudonym(req.user.id, post.course_id);
    }

    const isTeacher = req.user.role === 'teacher';

    const insertRes = await db.query(
      `INSERT INTO doubt_replies (
         doubt_post_id, author_id, body, is_anonymous, pseudonym, is_teacher_endorsed
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [postId, req.user.id, body.trim(), is_anonymous, pseudonym, isTeacher]
    );

    res.status(201).json({
      message: 'Reply posted successfully',
      reply: {
        ...insertRes.rows[0],
        author_display_name: is_anonymous ? pseudonym : req.user.full_name || 'You',
        author_role: req.user.role,
        user_has_marked_helpful: false,
      },
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error posting reply:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

/**
 * POST /doubts/:id/reveal-author
 * Role: Teacher
 * Reveals unmasked student identity behind an anonymous doubt post.
 */
router.post('/:id/reveal-author', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const postId = req.params.id;

    const result = await db.query(
      `SELECT dp.author_id, dp.course_id, dp.classroom_id, dp.audience_scope,
              u.id, u.full_name, u.email, u.role,
              dp.is_anonymous, dp.pseudonym, dp.title, dp.created_at
       FROM doubt_posts dp
       JOIN users u ON dp.author_id = u.id
       WHERE dp.id = $1`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const row = result.rows[0];
    const access = await resolveDoubtAccess(req.user, {
      author_id: row.author_id,
      course_id: row.course_id,
      classroom_id: row.classroom_id,
      audience_scope: row.audience_scope,
    });

    if (!access.isTeacher || !access.canModify) {
      return res.status(403).json({ error: 'Forbidden: You cannot moderate this doubt post' });
    }

    res.json({
      author: {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        is_anonymous: row.is_anonymous,
        pseudonym: row.pseudonym,
        title: row.title,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error revealing author:', err);
    res.status(500).json({ error: 'Failed to reveal author' });
  }
});

/**
 * POST /doubts/helpful
 * Toggle helpful mark on a Post or Reply.
 */
router.post('/helpful', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id } = req.body;

    if (!target_type || !['POST', 'REPLY'].includes(target_type) || !target_id) {
      return res.status(400).json({ error: 'target_type (POST/REPLY) and target_id are required' });
    }

    let table;
    let access;

    if (target_type === 'POST') {
      const postRes = await db.query(
        'SELECT id, author_id, course_id, classroom_id, audience_scope FROM doubt_posts WHERE id = $1',
        [target_id]
      );
      if (postRes.rows.length === 0) {
        return res.status(404).json({ error: 'Doubt post not found' });
      }
      access = await resolveDoubtAccess(req.user, postRes.rows[0]);
      table = 'doubt_posts';
    } else {
      const replyRes = await db.query(
        `SELECT dr.id, dr.doubt_post_id,
                dp.author_id, dp.course_id, dp.classroom_id, dp.audience_scope
         FROM doubt_replies dr
         JOIN doubt_posts dp ON dr.doubt_post_id = dp.id
         WHERE dr.id = $1`,
        [target_id]
      );
      if (replyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Reply not found' });
      }
      const row = replyRes.rows[0];
      access = await resolveDoubtAccess(req.user, {
        author_id: row.author_id,
        course_id: row.course_id,
        classroom_id: row.classroom_id,
        audience_scope: row.audience_scope,
      });
      table = 'doubt_replies';
    }

    if (!access.canView) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this doubt' });
    }

    const client = await db.pool.connect();
    let marked = false;
    let newCount = 0;

    try {
      await client.query('BEGIN');

      const checkRes = await client.query(
        'SELECT id FROM doubt_helpful_marks WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
        [req.user.id, target_type, target_id]
      );

      if (checkRes.rows.length > 0) {
        // Remove mark
        await client.query(
          'DELETE FROM doubt_helpful_marks WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
          [req.user.id, target_type, target_id]
        );
        const updateRes = await client.query(
          `UPDATE ${table} SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = $1 RETURNING helpful_count`,
          [target_id]
        );
        marked = false;
        newCount = updateRes.rows[0]?.helpful_count || 0;
      } else {
        // Add mark
        await client.query(
          'INSERT INTO doubt_helpful_marks (user_id, target_type, target_id) VALUES ($1, $2, $3)',
          [req.user.id, target_type, target_id]
        );
        const updateRes = await client.query(
          `UPDATE ${table} SET helpful_count = helpful_count + 1 WHERE id = $1 RETURNING helpful_count`,
          [target_id]
        );
        marked = true;
        newCount = updateRes.rows[0]?.helpful_count || 1;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      marked,
      helpful_count: newCount,
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error toggling helpful:', err);
    res.status(500).json({ error: 'Failed to update helpful mark' });
  }
});

/**
 * POST /doubts/replies/:id/accept-solution
 * Mark or unmark a reply as the accepted solution (by post author or teacher).
 */
router.post('/replies/:id/accept-solution', authenticateToken, async (req, res) => {
  try {
    const replyId = req.params.id;

    const reply = await fetchReplyAccessRow(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const access = await resolveDoubtAccess(req.user, {
      author_id: reply.post_author_id,
      course_id: reply.course_id,
      classroom_id: reply.classroom_id,
      audience_scope: reply.audience_scope,
    });

    const isPostAuthor = reply.post_author_id === req.user.id;
    if (!isPostAuthor && !access.isTeacher) {
      return res.status(403).json({ error: 'Only the doubt author or a teacher can accept a solution' });
    }

    const newSolutionState = !reply.is_solution;

    // Reset other solutions on the same post if marking true
    if (newSolutionState) {
      await db.query(
        'UPDATE doubt_replies SET is_solution = FALSE WHERE doubt_post_id = $1',
        [reply.doubt_post_id]
      );
      await db.query(
        'UPDATE doubt_posts SET status = \'RESOLVED\' WHERE id = $1',
        [reply.doubt_post_id]
      );
    } else {
      await db.query(
        'UPDATE doubt_posts SET status = \'OPEN\' WHERE id = $1',
        [reply.doubt_post_id]
      );
    }

    const updateRes = await db.query(
      'UPDATE doubt_replies SET is_solution = $1 WHERE id = $2 RETURNING *',
      [newSolutionState, replyId]
    );

    res.json({
      message: newSolutionState ? 'Reply marked as accepted solution' : 'Reply unmarked as solution',
      reply: updateRes.rows[0],
      post_status: newSolutionState ? 'RESOLVED' : 'OPEN',
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error accepting solution:', err);
    res.status(500).json({ error: 'Failed to update accepted solution' });
  }
});

/**
 * POST /doubts/replies/:id/endorse
 * Role: Teacher
 * Teacher endorses an answer.
 */
router.post('/replies/:id/endorse', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const replyId = req.params.id;

    const reply = await fetchReplyAccessRow(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const access = await resolveDoubtAccess(req.user, {
      author_id: reply.post_author_id,
      course_id: reply.course_id,
      classroom_id: reply.classroom_id,
      audience_scope: reply.audience_scope,
    });

    if (!access.isTeacher) {
      return res.status(403).json({ error: 'Forbidden: You cannot moderate this doubt post' });
    }

    const replyRes = await db.query('SELECT * FROM doubt_replies WHERE id = $1', [replyId]);
    if (replyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const newEndorsedState = !replyRes.rows[0].is_teacher_endorsed;

    const updateRes = await db.query(
      'UPDATE doubt_replies SET is_teacher_endorsed = $1 WHERE id = $2 RETURNING *',
      [newEndorsedState, replyId]
    );

    res.json({
      message: newEndorsedState ? 'Reply endorsed by teacher' : 'Teacher endorsement removed',
      reply: updateRes.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error endorsing reply:', err);
    res.status(500).json({ error: 'Failed to endorse reply' });
  }
});

/**
 * DELETE /doubts/:id
 * Delete a doubt post (author or teacher who can moderate it).
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await fetchPostAccessRow(postId);
    if (!post) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const access = await resolveDoubtAccess(req.user, post);
    if (!access.canModify) {
      return res.status(403).json({ error: 'You do not have permission to delete this doubt post' });
    }

    // Clean up auxiliary marks & flags
    await db.query(
      `DELETE FROM doubt_helpful_marks 
       WHERE (target_type = 'POST' AND target_id = $1)
          OR (target_type = 'REPLY' AND target_id IN (SELECT id FROM doubt_replies WHERE doubt_post_id = $1))`,
      [postId]
    );

    await db.query(
      `DELETE FROM doubt_moderation_flags 
       WHERE (target_type = 'POST' AND target_id = $1)
          OR (target_type = 'REPLY' AND target_id IN (SELECT id FROM doubt_replies WHERE doubt_post_id = $1))`,
      [postId]
    );

    // Delete post (cascades to replies)
    await db.query('DELETE FROM doubt_posts WHERE id = $1', [postId]);

    res.json({ message: 'Doubt post deleted successfully' });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error deleting doubt post:', err);
    res.status(500).json({ error: 'Failed to delete doubt post' });
  }
});

/**
 * DELETE /doubts/replies/:id
 * Delete a doubt reply (reply author or teacher who can moderate the post).
 */
router.delete('/replies/:id', authenticateToken, async (req, res) => {
  try {
    const replyId = req.params.id;

    const reply = await fetchReplyAccessRow(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const access = await resolveDoubtAccess(req.user, {
      author_id: reply.post_author_id,
      course_id: reply.course_id,
      classroom_id: reply.classroom_id,
      audience_scope: reply.audience_scope,
    });

    const isAuthor = reply.author_id === req.user.id;
    if (!isAuthor && !access.isTeacher) {
      return res.status(403).json({ error: 'You do not have permission to delete this reply' });
    }

    // Clean up helpful marks and flags for this reply
    await db.query("DELETE FROM doubt_helpful_marks WHERE target_type = 'REPLY' AND target_id = $1", [replyId]);
    await db.query("DELETE FROM doubt_moderation_flags WHERE target_type = 'REPLY' AND target_id = $1", [replyId]);

    // Delete the reply
    await db.query('DELETE FROM doubt_replies WHERE id = $1', [replyId]);

    // If the reply was marked as solution, check if any other solution remains
    if (reply.is_solution) {
      const remainingSolutions = await db.query(
        'SELECT id FROM doubt_replies WHERE doubt_post_id = $1 AND is_solution = TRUE',
        [reply.doubt_post_id]
      );
      if (remainingSolutions.rows.length === 0) {
        await db.query("UPDATE doubt_posts SET status = 'OPEN' WHERE id = $1", [reply.doubt_post_id]);
      }
    }

    res.json({ message: 'Reply deleted successfully' });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error deleting reply:', err);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

/**
 * PUT /doubts/:id
 * Edit an existing doubt post title or body (author or teacher who can moderate).
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, body } = req.body;

    const post = await fetchPostAccessRow(postId);
    if (!post) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const access = await resolveDoubtAccess(req.user, post);
    if (!access.canModify) {
      return res.status(403).json({ error: 'You do not have permission to edit this doubt post' });
    }

    if (title === undefined && body === undefined) {
      return res.status(400).json({ error: 'At least title or body is required to update' });
    }

    let updateFields = [];
    let params = [postId];
    let idx = 2;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > MAX_TITLE_LENGTH) {
        return res.status(400).json({ error: `Title must be between 1 and ${MAX_TITLE_LENGTH} characters` });
      }
      updateFields.push(`title = $${idx}`);
      params.push(title.trim());
      idx++;
    }

    if (body !== undefined) {
      if (typeof body !== 'string' || body.trim().length === 0 || body.trim().length > MAX_BODY_LENGTH) {
        return res.status(400).json({ error: `Body must be between 1 and ${MAX_BODY_LENGTH} characters` });
      }
      updateFields.push(`body = $${idx}`);
      params.push(body.trim());
      idx++;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const updateRes = await db.query(
      `UPDATE doubt_posts SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    res.json({ message: 'Doubt post updated successfully', post: updateRes.rows[0] });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error updating doubt post:', err);
    res.status(500).json({ error: 'Failed to update doubt post' });
  }
});

/**
 * PUT /doubts/replies/:id
 * Edit an existing reply body (author or teacher who can moderate the post).
 */
router.put('/replies/:id', authenticateToken, async (req, res) => {
  try {
    const replyId = req.params.id;
    const { body } = req.body;

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Reply body cannot be empty' });
    }

    if (body.trim().length > MAX_BODY_LENGTH) {
      return res.status(400).json({ error: `Reply body must be ${MAX_BODY_LENGTH} characters or fewer` });
    }

    const profanity = checkProfanity(body);
    if (profanity.isBlocked) {
      return res.status(400).json({
        error: 'Your reply contains language that is not allowed in the doubt forum. Please revise it.',
      });
    }

    const reply = await fetchReplyAccessRow(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const access = await resolveDoubtAccess(req.user, {
      author_id: reply.post_author_id,
      course_id: reply.course_id,
      classroom_id: reply.classroom_id,
      audience_scope: reply.audience_scope,
    });

    const isAuthor = reply.author_id === req.user.id;
    if (!isAuthor && !access.isTeacher) {
      return res.status(403).json({ error: 'You do not have permission to edit this reply' });
    }

    const updateRes = await db.query(
      'UPDATE doubt_replies SET body = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [body.trim(), replyId]
    );

    res.json({ message: 'Reply updated successfully', reply: updateRes.rows[0] });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error updating reply:', err);
    res.status(500).json({ error: 'Failed to update reply' });
  }
});

module.exports = router;
