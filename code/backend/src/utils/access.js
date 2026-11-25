const db = require('../db');

/**
 * Access-control helpers shared by the doubt forum, search, classrooms,
 * sessions and the Socket.io layer. Every query is parameterized and the
 * caller's role always comes from the verified JWT (`req.user`), never from
 * client-supplied input.
 */

async function getClassroom(classroomId) {
  if (!classroomId) return null;
  const result = await db.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
  return result.rows[0] || null;
}

async function isClassroomTeacher(userId, classroomId) {
  if (!userId || !classroomId) return false;
  const result = await db.query(
    'SELECT 1 FROM classrooms WHERE id = $1 AND teacher_id = $2 LIMIT 1',
    [classroomId, userId]
  );
  return result.rows.length > 0;
}

async function isEnrolled(studentId, classroomId) {
  if (!studentId || !classroomId) return false;
  const result = await db.query(
    'SELECT 1 FROM enrollments WHERE classroom_id = $1 AND student_id = $2 LIMIT 1',
    [classroomId, studentId]
  );
  return result.rows.length > 0;
}

async function canAccessClassroom(user, classroomId) {
  if (!user || !classroomId) return false;
  if (user.role === 'teacher') {
    return isClassroomTeacher(user.id, classroomId);
  }
  if (user.role === 'student') {
    return isEnrolled(user.id, classroomId);
  }
  return false;
}

async function isCourseTeacher(userId, courseId) {
  if (!userId || !courseId) return false;
  const result = await db.query(
    'SELECT 1 FROM classrooms WHERE course_id = $1 AND teacher_id = $2 LIMIT 1',
    [courseId, userId]
  );
  return result.rows.length > 0;
}

async function isCourseMember(user, courseId) {
  if (!user || !courseId) return false;

  if (user.role === 'teacher') {
    return isCourseTeacher(user.id, courseId);
  }

  if (user.role === 'student') {
    const result = await db.query(
      `SELECT 1
       FROM enrollments e
       JOIN classrooms c ON e.classroom_id = c.id
       WHERE e.student_id = $1 AND c.course_id = $2
       LIMIT 1`,
      [user.id, courseId]
    );
    return result.rows.length > 0;
  }

  return false;
}

/**
 * Resolve the permissions a user has on a doubt post.
 *
 * APP:       any authenticated user can view; author or any teacher can modify.
 * COURSE:    members can view; author or a teacher of the course can modify.
 * CLASSROOM: classroom members can view; author or the owning teacher can modify.
 */
async function resolveDoubtAccess(user, post) {
  if (!user || !post) {
    return { isAuthor: false, isTeacher: false, canView: false, canModify: false };
  }

  const isAuthor = post.author_id === user.id;
  const scope = post.audience_scope;

  let isTeacher = false;
  let canView = false;

  if (scope === 'APP') {
    canView = true;
    isTeacher = user.role === 'teacher';
  } else if (scope === 'COURSE') {
    canView = await isCourseMember(user, post.course_id);
    isTeacher = await isCourseTeacher(user.id, post.course_id);
  } else if (scope === 'CLASSROOM') {
    canView = await canAccessClassroom(user, post.classroom_id);
    isTeacher = await isClassroomTeacher(user.id, post.classroom_id);
  }

  return {
    isAuthor,
    isTeacher,
    canView,
    canModify: isAuthor || isTeacher,
  };
}

module.exports = {
  getClassroom,
  isClassroomTeacher,
  isEnrolled,
  canAccessClassroom,
  isCourseTeacher,
  isCourseMember,
  resolveDoubtAccess,
};
