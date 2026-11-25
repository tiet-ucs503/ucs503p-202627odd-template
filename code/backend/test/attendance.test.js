const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { resetRedis } = require('./helpers/mockRedis');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');
const { generate3QrSequence } = require('../src/services/qrTokenService');

const SESSION = '77777777-7777-4777-8777-777777777777';
const CLASSROOM = '88888888-8888-4888-8888-888888888888';
const STUDENT = users.student.id;

let server;
let base;
let io;

before(async () => {
  const built = buildApp();
  io = built.io;
  const started = await start(built.app);
  server = started.server;
  base = started.base;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  reset();
  resetRedis();
  io.events.length = 0;
});

function hmac(payload) {
  return crypto
    .createHmac('sha256', process.env.QR_HMAC_SECRET)
    .update(payload)
    .digest('hex');
}

function ageBatch(batch, timestamp) {
  return {
    ...batch,
    timestamp,
    tokens: batch.tokens.map((token, index) => ({
      ...token,
      timestamp,
      hash: hmac(`${SESSION}:${token.batch_id}:${index}:${timestamp}:${token.token_id}`),
    })),
  };
}

function scanDbHandler() {
  return async (sql, params) => {
    if (/from sessions where id/i.test(sql)) {
      return {
        rows: [{ id: SESSION, classroom_id: CLASSROOM, ended_at: null }],
      };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'enrollment' }] };
    if (/from attendance_records/i.test(sql)) return { rows: [] };
    if (/insert into attendance_records/i.test(sql)) {
      return {
        rows: [
          {
            id: 'record-1',
            session_id: SESSION,
            student_id: STUDENT,
            scan_started_at: params[2],
            validated_at: params[3],
            status: 'PRESENT',
          },
        ],
      };
    }
    return { rows: [] };
  };
}

test('attendance scan requires session_id and tokens', async () => {
  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: { session_id: SESSION },
  });
  assert.equal(res.status, 400);
});

test('a valid scan returns 200 and broadcasts attendance:marked', async () => {
  const batch = await generate3QrSequence(SESSION);
  const timestamp = Date.now() - 3000;
  const aged = ageBatch(batch, timestamp);
  setHandler(scanDbHandler());

  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: {
      session_id: SESSION,
      tokens: aged.tokens,
      scan_started_at: new Date(timestamp + 1000).toISOString(),
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.record.status, 'PRESENT');
  assert.ok(res.body.acl_ms >= 1500);

  const event = io.events.find((e) => e.event === 'attendance:marked');
  assert.ok(event, 'expected attendance:marked to be emitted');
  assert.equal(event.room, `session_${SESSION}`);
  assert.equal(event.payload.student.id, STUDENT);
});

test('an invalid scan is rejected with the service status code', async () => {
  setHandler(scanDbHandler());
  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: { session_id: SESSION, tokens: [{ seq_idx: 0 }] },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Exactly 3/);
});

test('only the owning teacher can read the live session roster', async () => {
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
            course_name: 'Software Engineering Lab',
            section_name: '3CSE1',
          },
        ],
      };
    }
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const owner = await request(base, 'GET', `/attendance/session/${SESSION}`, {
    token: makeToken(users.teacher),
  });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.total_present, 0);

  const other = await request(base, 'GET', `/attendance/session/${SESSION}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(other.status, 403);
});

test('students can read their own attendance overview', async () => {
  setHandler(async (sql) => {
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/attendance/me', { token: makeToken() });
  assert.equal(res.status, 200);
  assert.equal(res.body.overall.total_sessions, 0);
  assert.equal(res.body.overall.attended_sessions, 0);
  assert.equal(res.body.overall.attendance_percentage, 0);
});

test('teachers cannot call the student-only attendance overview', async () => {
  const res = await request(base, 'GET', '/attendance/me', {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 403);
});

test('manual override validates the status value', async () => {
  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'MAYBE',
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /PRESENT or ABSENT/);
});

test('manual override rejects a teacher who does not own the classroom', async () => {
  setHandler(async (sql) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'PRESENT',
    },
  });
  assert.equal(res.status, 403);
});

test('manual override upserts PRESENT for an enrolled student', async () => {
  let upsertSql = null;
  setHandler(async (sql, params) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/select id, started_at from sessions where id = \$1 and classroom_id/i.test(sql)) {
      return { rows: [{ id: SESSION, started_at: '2026-11-03T10:00:00.000Z' }] };
    }
    if (/select id, joined_at from enrollments where classroom_id = \$1 and student_id/i.test(sql)) {
      return { rows: [{ id: 'enrollment', joined_at: '2026-11-03T09:00:00.000Z' }] };
    }
    if (/insert into attendance_records/i.test(sql)) {
      upsertSql = sql;
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'present',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'PRESENT');
  assert.ok(upsertSql, 'expected an attendance upsert');
  assert.match(upsertSql, /is_manual/i);
  assert.match(upsertSql, /TRUE/);
  assert.match(upsertSql, /DO UPDATE SET status = 'PRESENT'/i);
  // A real scan's timestamps must be preserved on conflict.
  assert.doesNotMatch(upsertSql, /validated_at = now\(\)/i);
  assert.doesNotMatch(upsertSql, /scan_started_at = now\(\)/i);
});

test('manual override rejects a session that started before enrollment and writes nothing', async () => {
  let writeCalled = false;
  setHandler(async (sql) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/select id, started_at from sessions where id = \$1 and classroom_id/i.test(sql)) {
      return { rows: [{ id: SESSION, started_at: '2026-11-01T09:00:00.000Z' }] };
    }
    if (/select id, joined_at from enrollments where classroom_id = \$1 and student_id/i.test(sql)) {
      return { rows: [{ id: 'enrollment', joined_at: '2026-11-02T09:00:00.000Z' }] };
    }
    if (
      /insert into attendance_records/i.test(sql) ||
      /delete from attendance_records/i.test(sql)
    ) {
      writeCalled = true;
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'PRESENT',
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /before the student enrolled/i);
  assert.equal(writeCalled, false);
});

test('manual override refuses students who are not enrolled', async () => {
  setHandler(async (sql) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/select id, started_at from sessions where id = \$1 and classroom_id/i.test(sql)) {
      return { rows: [{ id: SESSION, started_at: '2026-11-03T10:00:00.000Z' }] };
    }
    if (/select id, joined_at from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'ABSENT',
    },
  });
  assert.equal(res.status, 400);
});

test('classroom summary reports zero attendance when there are no sessions or students', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/from sessions s/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) return { rows: [] };
    if (/from attendance_records ar/i.test(sql)) {
      return { rows: [{ overall_avg_acl_ms: null }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/attendance/classroom/${CLASSROOM}/summary`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stats.average_attendance_percentage, 0);
  assert.equal(res.body.stats.total_sessions, 0);

  const perStudentQuery = calls.find(
    (call) => /from enrollments en/i.test(call.sql) && /attendance_percentage/i.test(call.sql)
  );
  assert.ok(perStudentQuery);
  assert.match(perStudentQuery.sql, /s\.started_at >= en\.joined_at/i);
  assert.match(perStudentQuery.sql, /s\.ended_at IS NOT NULL/i);
  assert.match(perStudentQuery.sql, /COUNT\(DISTINCT s\.id\)/i);
  assert.match(perStudentQuery.sql, /COUNT\(DISTINCT s\.id\)::int as total_sessions/i);
  assert.match(perStudentQuery.sql, /FILTER \(WHERE ar\.is_manual = FALSE\)/i);
  assert.match(perStudentQuery.sql, /EXTRACT\(EPOCH/i);

  const sessionsQuery = calls.find(
    (call) => /from sessions s/i.test(call.sql) && /present_count/i.test(call.sql)
  );
  assert.ok(sessionsQuery);
  assert.match(sessionsQuery.sql, /as is_live/i);
  assert.match(sessionsQuery.sql, /FILTER \(WHERE ar\.is_manual = FALSE\)/i);
  assert.match(sessionsQuery.sql, /FILTER \(WHERE EXISTS/i);

  const aclQuery = calls.find((call) => /overall_avg_acl_ms/i.test(call.sql));
  assert.ok(aclQuery);
  assert.match(aclQuery.sql, /EXTRACT\(EPOCH/i);
  assert.match(aclQuery.sql, /FILTER \(WHERE ar\.is_manual = FALSE\)/i);
});

test('class attendance rate ignores students with no sessions since they enrolled', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: 's1',
            started_at: '2026-11-03T10:43:42.760Z',
            ended_at: '2026-11-03T10:47:01.696Z',
            is_live: false,
            present_count: 1,
            enrolled_count: 1,
            avg_acl_ms: 500,
          },
          {
            id: 's-live',
            started_at: '2026-11-03T11:00:00.000Z',
            ended_at: null,
            is_live: true,
            present_count: 1,
            enrolled_count: 1,
            avg_acl_ms: null,
          },
        ],
      };
    }
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            student_id: 'student-1',
            full_name: 'On Time',
            email: 'ontime@example.com',
            joined_at: '2026-11-03T10:00:00.000Z',
            total_sessions: 3,
            attended_sessions: 3,
            attendance_percentage: 100,
          },
          {
            student_id: 'student-2',
            full_name: 'Late Joiner',
            email: 'late@example.com',
            joined_at: '2026-11-03T10:49:12.331Z',
            total_sessions: 0,
            attended_sessions: 0,
            attendance_percentage: 0,
          },
        ],
      };
    }
    if (/from attendance_records ar/i.test(sql)) {
      return { rows: [{ overall_avg_acl_ms: null }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/attendance/classroom/${CLASSROOM}/summary`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  // Late joiner has 0 eligible sessions, so only the on-time student counts.
  assert.equal(res.body.stats.average_attendance_percentage, 100);
  assert.equal(res.body.stats.total_enrolled, 2);
  // The live session is visible in history but is not counted as conducted.
  assert.equal(res.body.stats.total_sessions, 1);
  assert.equal(res.body.sessions.length, 2);
  const liveRow = res.body.sessions.find((s) => s.id === 's-live');
  assert.equal(liveRow.is_live, true);
  assert.equal(liveRow.present_count, 1);
  assert.equal(liveRow.enrolled_count, 1);

  const sessionsQuery = calls.find(
    (call) => /from sessions s/i.test(call.sql) && /present_count/i.test(call.sql)
  );
  assert.ok(sessionsQuery);
  assert.match(sessionsQuery.sql, /as enrolled_count/i);
  assert.match(sessionsQuery.sql, /e\.joined_at <= s\.started_at/i);
  assert.match(sessionsQuery.sql, /as is_live/i);
});

test('student attendance summary only counts sessions after enrollment', async () => {
  setHandler(async (sql) => {
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            classroom_id: CLASSROOM,
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            section_name: '3CSE1',
            teacher_name: 'Prof. Teacher',
            total_sessions: 2,
            attended_sessions: 1,
            attendance_percentage: 50,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/attendance/me', { token: makeToken() });

  assert.equal(res.status, 200);
  assert.equal(res.body.overall.total_sessions, 2);
  assert.equal(res.body.overall.attended_sessions, 1);
  assert.equal(res.body.overall.attendance_percentage, 50);

  const summaryQuery = calls.find(
    (call) => /from enrollments en/i.test(call.sql) && /attendance_percentage/i.test(call.sql)
  );
  assert.ok(summaryQuery);
  assert.match(summaryQuery.sql, /s\.started_at >= en\.joined_at/i);
  assert.match(summaryQuery.sql, /s\.ended_at IS NOT NULL/i);
  assert.match(summaryQuery.sql, /COUNT\(DISTINCT s\.id\)/i);
});

test('student drilldown rejects a student who is not enrolled in the classroom', async () => {
  setHandler(async (sql) => {
    if (/select teacher_id from classrooms/i.test(sql)) {
      return { rows: [{ teacher_id: users.teacher.id }] };
    }
    if (/select id, full_name, email from users/i.test(sql)) {
      return { rows: [{ id: STUDENT, full_name: 'Test Student', email: 'student@example.com' }] };
    }
    if (/from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(
    base,
    'GET',
    `/attendance/classroom/${CLASSROOM}/student/${STUDENT}`,
    { token: makeToken(users.teacher) }
  );

  assert.equal(res.status, 400);
  assert.match(res.body.error, /not enrolled/);
});

test('student drilldown marks pre-enrollment sessions as ineligible', async () => {
  setHandler(async (sql) => {
    if (/select teacher_id from classrooms/i.test(sql)) {
      return { rows: [{ teacher_id: users.teacher.id }] };
    }
    if (/select id, full_name, email from users/i.test(sql)) {
      return { rows: [{ id: STUDENT, full_name: 'Test Student', email: 'student@example.com' }] };
    }
    if (/from sessions s/i.test(sql) && /as eligible/i.test(sql)) {
      return {
        rows: [
          {
            session_id: 'after-enrollment',
            started_at: '2026-11-02T09:00:00.000Z',
            ended_at: '2026-11-02T10:00:00.000Z',
            status: 'PRESENT',
            validated_at: '2026-11-02T09:00:05.000Z',
            scan_started_at: '2026-11-02T09:00:00.000Z',
            eligible: true,
            acl_ms: 5000,
          },
          {
            session_id: 'before-enrollment',
            started_at: '2026-11-01T09:00:00.000Z',
            ended_at: '2026-11-01T10:00:00.000Z',
            status: null,
            validated_at: null,
            scan_started_at: null,
            eligible: false,
            acl_ms: null,
          },
        ],
      };
    }
    if (/from enrollments/i.test(sql)) {
      return { rows: [{ id: 'enrollment', joined_at: '2026-11-02T00:00:00.000Z' }] };
    }
    return { rows: [] };
  });

  const res = await request(
    base,
    'GET',
    `/attendance/classroom/${CLASSROOM}/student/${STUDENT}`,
    { token: makeToken(users.teacher) }
  );

  assert.equal(res.status, 200);
  const after = res.body.sessions.find((s) => s.session_id === 'after-enrollment');
  const before = res.body.sessions.find((s) => s.session_id === 'before-enrollment');

  assert.equal(after.eligible, true);
  assert.equal(after.status, 'PRESENT');
  assert.equal(after.acl_ms, 5000);
  assert.equal(after.validated_at, '2026-11-02T09:00:05.000Z');

  assert.equal(before.eligible, false);
  assert.equal(before.status, 'NOT_ENROLLED');
  assert.equal(before.validated_at, null);
  assert.equal(before.acl_ms, null);

  const recordsQuery = calls.find((call) => /as eligible/i.test(call.sql));
  assert.ok(recordsQuery);
  assert.match(recordsQuery.sql, /s\.started_at >=/i);
  assert.match(recordsQuery.sql, /EXTRACT\(EPOCH/i);
  assert.match(recordsQuery.sql, /CASE WHEN ar\.id IS NULL THEN NULL/i);
  assert.match(recordsQuery.sql, /WHEN ar\.is_manual THEN NULL/i);
});

test('attendance warning threshold must be between 0 and 100', async () => {
  const res = await request(base, 'POST', `/attendance/classroom/${CLASSROOM}/send-warnings`, {
    token: makeToken(users.teacher),
    body: { threshold: 150 },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /threshold/);
});

test('warning query ignores students with no sessions since they enrolled', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            section_name: '3C75',
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            teacher_name: 'Prof. Teacher',
          },
        ],
      };
    }
    if (/from sessions where classroom_id/i.test(sql)) {
      return { rows: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };
    }
    if (/from enrollments en/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/attendance/classroom/${CLASSROOM}/send-warnings`, {
    token: makeToken(users.teacher),
    body: { threshold: 75 },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 0);

  const warningQuery = calls.find(
    (call) => /from enrollments en/i.test(call.sql) && /having/i.test(call.sql)
  );
  assert.ok(warningQuery);
  assert.match(warningQuery.sql, /HAVING COUNT\(DISTINCT s\.id\) > 0/i);
  assert.match(warningQuery.sql, /s\.ended_at IS NOT NULL/i);

  const sessionsCheck = calls.find(
    (call) => /from sessions where classroom_id/i.test(call.sql)
  );
  assert.ok(sessionsCheck);
  assert.match(sessionsCheck.sql, /ended_at IS NOT NULL/i);
});

test('warnings are refused when only a live session exists', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            section_name: '3C75',
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            teacher_name: 'Prof. Teacher',
          },
        ],
      };
    }
    // Simulate the DB filter: only completed sessions are returned.
    if (/from sessions where classroom_id/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/attendance/classroom/${CLASSROOM}/send-warnings`, {
    token: makeToken(users.teacher),
    body: { threshold: 75 },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /No sessions conducted yet/i);

  const studentQuery = calls.find((call) => /having/i.test(call.sql));
  assert.equal(studentQuery, undefined, 'must not select recipients from a live session');

  const sessionsCheck = calls.find(
    (call) => /from sessions where classroom_id/i.test(call.sql)
  );
  assert.ok(sessionsCheck);
  assert.match(sessionsCheck.sql, /ended_at IS NOT NULL/i);
});
