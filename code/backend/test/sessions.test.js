const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset } = require('./helpers/mockDb');
const { resetRedis } = require('./helpers/mockRedis');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const CLASSROOM = '18181818-1818-4818-8818-181818181818';
const SESSION = '19191919-1919-4919-8919-191919191919';

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

beforeEach(() => {
  reset();
  resetRedis();
});

test('only the owning teacher can start a session', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/sessions', {
    token: makeToken(users.otherTeacher),
    body: { classroom_id: CLASSROOM },
  });
  assert.equal(res.status, 403);
});

test('starting a session is idempotent when one is already active', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
          },
        ],
      };
    }
    if (/from sessions/i.test(sql) && /ended_at is null/i.test(sql)) {
      return { rows: [{ id: SESSION, classroom_id: CLASSROOM, started_at: new Date().toISOString() }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/sessions', {
    token: makeToken(users.teacher),
    body: { classroom_id: CLASSROOM },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.already_active, true);
  assert.equal(res.body.session.id, SESSION);
});

test('starting a fresh session returns an initial 3-QR batch', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
          },
        ],
      };
    }
    if (/from sessions/i.test(sql) && /ended_at is null/i.test(sql)) return { rows: [] };
    if (/insert into sessions/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            started_at: new Date().toISOString(),
            ended_at: null,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/sessions', {
    token: makeToken(users.teacher),
    body: { classroom_id: CLASSROOM },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.initial_tokens.tokens.length, 3);
});

test('only the owning teacher can end a session', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            ended_at: null,
            course_code: 'UCS503P',
            section_name: '3CSE1',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/sessions/${SESSION}/end`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('ending a session resolves pending live activities', async () => {
  const statements = [];
  setHandler(async (sql, params) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            ended_at: null,
            course_code: 'UCS503P',
            section_name: '3CSE1',
          },
        ],
      };
    }
    if (/update sessions/i.test(sql)) {
      return { rows: [{ id: SESSION, ended_at: new Date().toISOString() }] };
    }
    if (/count\(\*\)::int as total_present/i.test(sql)) return { rows: [{ total_present: 3 }] };
    if (/from live_activities/i.test(sql) && /attendance_pending = true/i.test(sql)) {
      return { rows: [{ id: 'activity-1' }, { id: 'activity-2' }] };
    }
    if (/update live_activities/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/sessions/${SESSION}/end`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.total_present, 3);
  assert.ok(statements.some((s) => /attendance_session_id = \$1/i.test(s)));
});

test('a non-member cannot read a session by id', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
            teacher_name: users.teacher.full_name,
            present_count: 10,
            total_enrolled: 40,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/sessions/${SESSION}`, {
    token: makeToken(users.otherStudent),
  });
  assert.equal(res.status, 403);
});

test('an enrolled student can read a session by id', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
            teacher_name: users.teacher.full_name,
            present_count: 10,
            total_enrolled: 40,
          },
        ],
      };
    }
    if (/select 1 from enrollments/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/sessions/${SESSION}`, {
    token: makeToken(users.student),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.session.id, SESSION);
  assert.equal(res.body.session.teacher_id, undefined);
});

test('the owning teacher can read a session by id', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            course_code: 'UCS503P',
            course_name: 'SE Lab',
            section_name: '3CSE1',
            teacher_name: users.teacher.full_name,
            present_count: 10,
            total_enrolled: 40,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/sessions/${SESSION}`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 200);
});

test('active-mine returns every active session plus a legacy session field', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return { rows: [{ id: 'session-a' }, { id: 'session-b' }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/sessions/active-mine', {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.sessions.length, 2);
  assert.equal(res.body.session.id, 'session-a');
});
