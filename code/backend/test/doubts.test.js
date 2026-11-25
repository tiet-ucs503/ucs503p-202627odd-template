const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const COURSE = '14141414-1414-4414-8414-141414141414';
const CLASSROOM = '15151515-1515-4515-8515-151515151515';
const POST = '16161616-1616-4616-8616-161616161616';
const REPLY = '17171717-1717-4717-8717-171717171717';
const TOPIC = '18181818-1818-4818-8818-181818181818';

let server;
let base;

before(async () => {
  const { app } = buildApp();
  const started = await start(app);
  server = started.server;
  base = started.base;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => reset());

const postRow = {
  id: POST,
  course_id: COURSE,
  classroom_id: CLASSROOM,
  topic_id: null,
  author_id: users.student.id,
  audience_scope: 'CLASSROOM',
  title: 'Why?',
  body: 'Body',
  is_anonymous: false,
  pseudonym: null,
  status: 'OPEN',
  helpful_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author_real_name: users.student.full_name,
  author_email: users.student.email,
  author_role: 'student',
  topic_name: null,
  course_code: 'UCS503P',
  course_name: 'SE Lab',
  user_has_marked_helpful: false,
  reply_count: 0,
  has_accepted_solution: null,
};

function enrollmentRow() {
  return { rows: [{ '?column?': 1 }] };
}

function classroomRow(overrides = {}) {
  return {
    rows: [
      {
        id: CLASSROOM,
        course_id: COURSE,
        teacher_id: users.teacher.id,
        section_name: '3CSE1',
        ...overrides,
      },
    ],
  };
}

test('doubt creation requires a course, title, and body', async () => {
  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: { course_id: COURSE },
  });
  assert.equal(res.status, 400);
});

test('doubt creation rejects an invalid audience scope', async () => {
  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      title: 'Why?',
      body: 'Body',
      audience_scope: 'EVERYONE',
    },
  });
  assert.equal(res.status, 400);
});

test('doubt creation rejects an overlong title', async () => {
  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: 'x'.repeat(256),
      body: 'Body',
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 400);
});

test('doubt creation rejects an overlong body', async () => {
  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: 'Why?',
      body: 'x'.repeat(10001),
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 400);
});

test('a student can create a doubt post in a classroom they belong to', async () => {
  setHandler(async (sql, params) => {
    if (/select id from courses/i.test(sql)) return { rows: [{ id: COURSE }] };
    if (/select \* from classrooms/i.test(sql)) return classroomRow();
    if (/select 1 from enrollments/i.test(sql)) return enrollmentRow();
    if (/insert into doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, title: params[5], body: params[6], audience_scope: params[4] }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: '  Why?  ',
      body: '  Body  ',
      audience_scope: 'CLASSROOM',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.post.title, 'Why?');
  assert.equal(res.body.post.body, 'Body');
});

test('a student cannot post into a classroom they are not enrolled in', async () => {
  setHandler(async (sql) => {
    if (/select id from courses/i.test(sql)) return { rows: [{ id: COURSE }] };
    if (/select \* from classrooms/i.test(sql)) return classroomRow();
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(users.otherStudent),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: 'Why?',
      body: 'Body',
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 403);
});

test('doubt creation rejects a topic from another course', async () => {
  setHandler(async (sql) => {
    if (/select id from courses/i.test(sql)) return { rows: [{ id: COURSE }] };
    if (/select \* from classrooms/i.test(sql)) return classroomRow();
    if (/select 1 from enrollments/i.test(sql)) return enrollmentRow();
    if (/from course_topics/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      topic_id: TOPIC,
      title: 'Why?',
      body: 'Body',
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 400);
});

test('doubt list rejects invalid pagination', async () => {
  const res = await request(base, 'GET', '/doubts?limit=0', { token: makeToken() });
  assert.equal(res.status, 400);

  const badOffset = await request(base, 'GET', '/doubts?offset=-1', { token: makeToken() });
  assert.equal(badOffset.status, 400);
});

test('doubt creation rejects a classroom that belongs to another course', async () => {
  const otherCourse = '19191919-1919-4919-8919-191919191919';
  setHandler(async (sql) => {
    if (/select id from courses/i.test(sql)) return { rows: [{ id: COURSE }] };
    if (/select \* from classrooms/i.test(sql)) return classroomRow({ course_id: otherCourse });
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: 'Why?',
      body: 'Body',
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /does not belong/);
});

test('doubt creation rejects profanity before writing to the database', async () => {
  const res = await request(base, 'POST', '/doubts', {
    token: makeToken(),
    body: {
      course_id: COURSE,
      classroom_id: CLASSROOM,
      title: 'Question',
      body: 'fuck this',
      audience_scope: 'CLASSROOM',
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not allowed/);
});

test('doubt replies reject profanity before writing to the database', async () => {
  const res = await request(base, 'POST', `/doubts/${POST}/replies`, {
    token: makeToken(),
    body: { body: 'shit' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not allowed/);
});

test('anonymous posts mask the real name and author id in list responses', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            ...postRow,
            author_id: users.otherStudent.id,
            author_real_name: users.otherStudent.full_name,
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/doubts', { token: makeToken() });
  assert.equal(res.status, 200);
  assert.equal(res.body.posts[0].author_display_name, 'QuantumFalcon24');
  assert.equal(res.body.posts[0].author_real_name, null);
  assert.equal(res.body.posts[0].author_id, null);
});

test('anonymous post details mask the author id and email for other students', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            ...postRow,
            author_id: users.otherStudent.id,
            author_real_name: users.otherStudent.full_name,
            author_email: users.otherStudent.email,
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
          },
        ],
      };
    }
    if (/from doubt_replies dr/i.test(sql)) return { rows: [] };
    if (/select 1 from enrollments/i.test(sql)) return enrollmentRow();
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/doubts/${POST}`, { token: makeToken() });
  assert.equal(res.status, 200);
  assert.equal(res.body.post.author_real_name, null);
  assert.equal(res.body.post.author_email, null);
  assert.equal(res.body.post.author_id, null);
  assert.equal(res.body.post.author_display_name, 'QuantumFalcon24');
  assert.equal(res.body.canRevealAuthor, false);
});

test('the anonymous author still sees their own identity', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            ...postRow,
            author_id: users.otherStudent.id,
            author_real_name: users.otherStudent.full_name,
            author_email: users.otherStudent.email,
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
          },
        ],
      };
    }
    if (/from doubt_replies dr/i.test(sql)) return { rows: [] };
    if (/select 1 from enrollments/i.test(sql)) return enrollmentRow();
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/doubts/${POST}`, {
    token: makeToken(users.otherStudent),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.post.author_id, users.otherStudent.id);
  assert.equal(res.body.post.author_email, users.otherStudent.email);
});

test('the classroom teacher sees the real identity and can reveal it', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            ...postRow,
            author_id: users.otherStudent.id,
            author_real_name: users.otherStudent.full_name,
            author_email: users.otherStudent.email,
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
          },
        ],
      };
    }
    if (/from doubt_replies dr/i.test(sql)) return { rows: [] };
    if (/from classrooms where id/i.test(sql)) return enrollmentRow();
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/doubts/${POST}`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.post.author_id, users.otherStudent.id);
  assert.equal(res.body.post.author_email, users.otherStudent.email);
  assert.equal(res.body.canRevealAuthor, true);
});

test('a student outside the classroom cannot read a classroom-scoped doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) return { rows: [postRow] };
    if (/from doubt_replies dr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/doubts/${POST}`, {
    token: makeToken(users.otherStudent),
  });
  assert.equal(res.status, 403);
});

test('a teacher from another classroom cannot read or moderate the doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) return { rows: [postRow] };
    if (/from doubt_replies dr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const read = await request(base, 'GET', `/doubts/${POST}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(read.status, 403);

  const remove = await request(base, 'DELETE', `/doubts/${POST}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(remove.status, 403);
});

test('reply body is required', async () => {
  const res = await request(base, 'POST', `/doubts/${POST}/replies`, {
    token: makeToken(),
    body: { body: '   ' },
  });
  assert.equal(res.status, 400);
});

test('an overlong reply body is rejected', async () => {
  const res = await request(base, 'POST', `/doubts/${POST}/replies`, {
    token: makeToken(),
    body: { body: 'x'.repeat(10001) },
  });
  assert.equal(res.status, 400);
});

test('a student can reply to an existing doubt in their classroom', async () => {
  setHandler(async (sql, params) => {
    if (/from doubt_posts/i.test(sql)) return { rows: [postRow] };
    if (/select 1 from enrollments/i.test(sql)) return enrollmentRow();
    if (/insert into doubt_replies/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.student.id,
            body: params[2],
            is_anonymous: params[3],
            pseudonym: params[4],
            is_teacher_endorsed: params[5],
            is_solution: false,
            helpful_count: 0,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/${POST}/replies`, {
    token: makeToken(),
    body: { body: 'Because of X.' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.reply.body, 'Because of X.');
});

test('a non-member cannot reply to a classroom doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) return { rows: [postRow] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/${POST}/replies`, {
    token: makeToken(users.otherStudent),
    body: { body: 'Because of X.' },
  });
  assert.equal(res.status, 403);
});

test('a student cannot delete someone else\'s doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, author_id: users.otherStudent.id }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', `/doubts/${POST}`, { token: makeToken() });
  assert.equal(res.status, 403);
});

test('the author can delete their own doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, author_id: users.student.id }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', `/doubts/${POST}`, { token: makeToken() });
  assert.equal(res.status, 200);
});

test('a student cannot edit someone else\'s doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, author_id: users.otherStudent.id }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'PUT', `/doubts/${POST}`, {
    token: makeToken(),
    body: { title: 'Hijacked' },
  });
  assert.equal(res.status, 403);
});

test('the author can edit their own doubt', async () => {
  setHandler(async (sql, params) => {
    if (/from doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, author_id: users.student.id }] };
    }
    if (/update doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, title: params[1] }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'PUT', `/doubts/${POST}`, {
    token: makeToken(),
    body: { title: 'Updated title' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.post.title, 'Updated title');
});

test('a teacher from another course cannot moderate a course doubt', async () => {
  const coursePost = { ...postRow, audience_scope: 'COURSE', classroom_id: null };
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) return { rows: [coursePost] };
    return { rows: [] };
  });

  const res = await request(base, 'PUT', `/doubts/${POST}`, {
    token: makeToken(users.otherTeacher),
    body: { title: 'Hijacked' },
  });
  assert.equal(res.status, 403);
});

test('a student cannot accept a solution on someone else\'s doubt', async () => {
  setHandler(async (sql) => {
    if (/from doubt_replies dr/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.otherStudent.id,
            is_solution: false,
            post_author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'APP',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/replies/${REPLY}/accept-solution`, {
    token: makeToken(),
  });
  assert.equal(res.status, 403);
});

test('the doubt author can accept a reply as the solution', async () => {
  setHandler(async (sql) => {
    if (/from doubt_replies dr/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.otherStudent.id,
            is_solution: false,
            post_author_id: users.student.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'APP',
          },
        ],
      };
    }
    return { rows: [{ id: REPLY, is_solution: true }] };
  });

  const res = await request(base, 'POST', `/doubts/replies/${REPLY}/accept-solution`, {
    token: makeToken(),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.post_status, 'RESOLVED');
});

test('a teacher who can moderate the post can accept a solution', async () => {
  setHandler(async (sql) => {
    if (/from doubt_replies dr/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.otherStudent.id,
            is_solution: false,
            post_author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'APP',
          },
        ],
      };
    }
    return { rows: [{ id: REPLY, is_solution: true }] };
  });

  const res = await request(base, 'POST', `/doubts/replies/${REPLY}/accept-solution`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 200);
});

test('only teachers can endorse a reply', async () => {
  const student = await request(base, 'POST', `/doubts/replies/${REPLY}/endorse`, {
    token: makeToken(),
  });
  assert.equal(student.status, 403);

  setHandler(async (sql) => {
    if (/from doubt_replies dr/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.otherStudent.id,
            is_solution: false,
            post_author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'APP',
          },
        ],
      };
    }
    if (/select \* from doubt_replies/i.test(sql)) {
      return { rows: [{ id: REPLY, is_teacher_endorsed: false }] };
    }
    if (/update doubt_replies/i.test(sql)) {
      return { rows: [{ id: REPLY, is_teacher_endorsed: true }] };
    }
    return { rows: [] };
  });

  const teacher = await request(base, 'POST', `/doubts/replies/${REPLY}/endorse`, {
    token: makeToken(users.teacher),
  });
  assert.equal(teacher.status, 200);
  assert.equal(teacher.body.reply.is_teacher_endorsed, true);
});

test('a teacher from another course cannot endorse a course reply', async () => {
  setHandler(async (sql) => {
    if (/from doubt_replies dr/i.test(sql)) {
      return {
        rows: [
          {
            id: REPLY,
            doubt_post_id: POST,
            author_id: users.otherStudent.id,
            is_solution: false,
            post_author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'COURSE',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/replies/${REPLY}/endorse`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('helpful marks can be added and removed inside a transaction', async () => {
  let hasMark = false;
  const statements = [];

  setHandler(async (sql) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/^select/i.test(sql.trim()) && /from doubt_posts/i.test(sql)) {
      return { rows: [{ ...postRow, audience_scope: 'APP' }] };
    }
    if (/select id from doubt_helpful_marks/i.test(sql)) {
      return { rows: hasMark ? [{ id: 'mark' }] : [] };
    }
    if (/insert into doubt_helpful_marks/i.test(sql)) {
      hasMark = true;
      return { rows: [] };
    }
    if (/delete from doubt_helpful_marks/i.test(sql)) {
      hasMark = false;
      return { rows: [] };
    }
    if (/update doubt_posts/i.test(sql)) {
      return { rows: [{ helpful_count: hasMark ? 1 : 0 }] };
    }
    return { rows: [] };
  });

  const added = await request(base, 'POST', '/doubts/helpful', {
    token: makeToken(),
    body: { target_type: 'POST', target_id: POST },
  });
  assert.equal(added.status, 200);
  assert.equal(added.body.marked, true);
  assert.equal(added.body.helpful_count, 1);

  const removed = await request(base, 'POST', '/doubts/helpful', {
    token: makeToken(),
    body: { target_type: 'POST', target_id: POST },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.marked, false);
  assert.equal(removed.body.helpful_count, 0);

  assert.ok(statements.includes('BEGIN'));
  assert.ok(statements.includes('COMMIT'));
});

test('a user cannot mark a doubt they cannot see as helpful', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts/i.test(sql)) return { rows: [postRow] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/doubts/helpful', {
    token: makeToken(users.otherStudent),
    body: { target_type: 'POST', target_id: POST },
  });
  assert.equal(res.status, 403);
});

test('only teachers can reveal an anonymous author', async () => {
  const student = await request(base, 'POST', `/doubts/${POST}/reveal-author`, {
    token: makeToken(),
  });
  assert.equal(student.status, 403);

  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'APP',
            id: users.otherStudent.id,
            full_name: users.otherStudent.full_name,
            email: users.otherStudent.email,
            role: 'student',
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
            title: 'Why?',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const teacher = await request(base, 'POST', `/doubts/${POST}/reveal-author`, {
    token: makeToken(users.teacher),
  });
  assert.equal(teacher.status, 200);
  assert.equal(teacher.body.author.email, users.otherStudent.email);
});

test('a teacher cannot reveal an anonymous post from a classroom they do not teach', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: CLASSROOM,
            audience_scope: 'CLASSROOM',
            id: users.otherStudent.id,
            full_name: users.otherStudent.full_name,
            email: users.otherStudent.email,
            role: 'student',
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
            title: 'Why?',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/${POST}/reveal-author`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('a teacher of the course can reveal a course-scoped anonymous post', async () => {
  setHandler(async (sql) => {
    if (/from doubt_posts dp/i.test(sql)) {
      return {
        rows: [
          {
            author_id: users.otherStudent.id,
            course_id: COURSE,
            classroom_id: null,
            audience_scope: 'COURSE',
            id: users.otherStudent.id,
            full_name: users.otherStudent.full_name,
            email: users.otherStudent.email,
            role: 'student',
            is_anonymous: true,
            pseudonym: 'QuantumFalcon24',
            title: 'Why?',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (/from classrooms/i.test(sql)) return enrollmentRow();
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/doubts/${POST}/reveal-author`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.author.email, users.otherStudent.email);
});
