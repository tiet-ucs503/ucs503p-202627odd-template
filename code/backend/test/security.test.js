const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');
const { rateLimit } = require('../src/middleware/rateLimit');
const { expireStaleSessions } = require('../src/services/sessionLifecycle');

const COURSE = '20202020-2020-4020-8020-202020202020';
const OTHER_COURSE = '21212121-2121-4121-8121-212121212121';
const CLASSROOM = '22222222-2222-4222-8222-222222222222';

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

test('search requires a non-empty q parameter', async () => {
  const res = await request(base, 'GET', '/search', { token: makeToken() });
  assert.equal(res.status, 400);

  const blank = await request(base, 'GET', '/search?q=%20%20', { token: makeToken() });
  assert.equal(blank.status, 400);
});

test('search binds the query and the current user as parameters', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'GET', '/search?q=graphs', { token: makeToken() });
  assert.equal(res.status, 200);

  const call = calls.find((c) => /ts_rank/i.test(c.sql));
  assert.ok(call);
  assert.equal(call.params[0], 'graphs');
  assert.equal(call.params[1], '%graphs%');
  assert.equal(call.params[call.params.length - 3], users.student.id);
});

test('classroom-scoped search still enforces the course filter', async () => {
  setHandler(async (sql) => {
    if (/from enrollments e/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    if (/select 1 from enrollments/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });

  const res = await request(
    base,
    'GET',
    `/search?q=graphs&course_id=${COURSE}&classroom_id=${CLASSROOM}`,
    { token: makeToken() }
  );
  assert.equal(res.status, 200);

  const call = calls.find((c) => /ts_rank/i.test(c.sql));
  assert.ok(call);
  // COURSE-scoped posts must be restricted to the requested course.
  assert.match(call.sql, /dp\.course_id = \$3/i);
});

test('the default classroom doubt feed also keeps the course filter', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'GET', `/doubts?course_id=${COURSE}&classroom_id=${CLASSROOM}`, {
    token: makeToken(),
  });
  assert.equal(res.status, 200);

  const call = calls.find((c) => /from doubt_posts dp/i.test(c.sql));
  assert.ok(call);
  assert.ok(call.params.includes(COURSE), 'course_id should be part of the query parameters');
});

test('an invalid limit is rejected with 400 before reaching SQL', async () => {
  setHandler(async (sql) => {
    if (/limit/i.test(sql)) throw new Error('LIMIT must not be negative');
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/search?q=graphs&limit=-5', {
    token: makeToken(),
  });
  assert.equal(res.status, 400);
});

test('an invalid offset is rejected with 400', async () => {
  const res = await request(base, 'GET', '/search?q=graphs&offset=-1', {
    token: makeToken(),
  });
  assert.equal(res.status, 400);
});

test('a non-member cannot search inside another course', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'GET', `/search?q=graphs&course_id=${OTHER_COURSE}`, {
    token: makeToken(users.otherStudent),
  });
  assert.equal(res.status, 403);
});

test('search returns the true total from the window count', async () => {
  setHandler(async (sql) => {
    if (/ts_rank/i.test(sql)) {
      return {
        rows: [
          {
            id: 'post-1',
            author_id: users.student.id,
            is_anonymous: false,
            author_real_name: users.student.full_name,
            pseudonym: null,
            total_count: 42,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/search?q=graphs&limit=1', {
    token: makeToken(),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 42);
  assert.equal(res.body.results.length, 1);
  assert.equal(res.body.results[0].total_count, undefined);
});

test('search masks anonymous author ids for non-moderators', async () => {
  setHandler(async (sql) => {
    if (/ts_rank/i.test(sql)) {
      return {
        rows: [
          {
            id: 'post-1',
            author_id: users.otherStudent.id,
            is_anonymous: true,
            author_real_name: users.otherStudent.full_name,
            pseudonym: 'QuantumFalcon24',
            total_count: 1,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/search?q=graphs', {
    token: makeToken(users.student),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.results[0].author_id, null);
  assert.equal(res.body.results[0].author_real_name, null);
  assert.equal(res.body.results[0].author_display_name, 'QuantumFalcon24');
});

test('rateLimit returns 429 once the per-IP threshold is exceeded', async () => {
  const limited = express();
  limited.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Too many requests. Please slow down.',
    })
  );
  limited.get('/ping', (_req, res) => res.json({ ok: true }));

  const started = await start(limited);

  try {
    const first = await request(started.base, 'GET', '/ping');
    const second = await request(started.base, 'GET', '/ping');
    const third = await request(started.base, 'GET', '/ping');

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.match(third.body.error, /Too many requests/);
  } finally {
    await started.close();
  }
});

test('rateLimit honors a custom keyGenerator', async () => {
  const limited = express();
  limited.use(express.json());
  limited.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 1,
      message: 'Too many attempts for this key.',
      keyGenerator: (req) => {
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        return email ? `email:${email}` : 'anonymous';
      },
    })
  );
  limited.post('/ping', (_req, res) => res.json({ ok: true }));

  const started = await start(limited);

  try {
    const firstA = await request(started.base, 'POST', '/ping', {
      body: { email: 'A@Example.com' },
    });
    const firstB = await request(started.base, 'POST', '/ping', {
      body: { email: 'b@example.com' },
    });
    const secondA = await request(started.base, 'POST', '/ping', {
      body: { email: 'a@example.com' },
    });

    assert.equal(firstA.status, 200);
    assert.equal(firstB.status, 200, 'a different generated key must not share the bucket');
    assert.equal(secondA.status, 429);
    assert.match(secondA.body.error, /Too many attempts for this key/);
  } finally {
    await started.close();
  }
});

test('topic creation rejects an unknown course with 404', async () => {
  setHandler(async () => ({ rows: [] }));

  const res = await request(base, 'POST', `/courses/${COURSE}/topics`, {
    token: makeToken(),
    body: { name: 'Graphs' },
  });

  assert.equal(res.status, 404);
});

test('topic creation rejects an overlong name with 400', async () => {
  const res = await request(base, 'POST', `/courses/${COURSE}/topics`, {
    token: makeToken(),
    body: { name: 'x'.repeat(101) },
  });

  assert.equal(res.status, 400);
});

test('topic listing rejects an unknown course with 404', async () => {
  setHandler(async () => ({ rows: [] }));

  const res = await request(base, 'GET', `/courses/${COURSE}/topics`, {
    token: makeToken(),
  });

  assert.equal(res.status, 404);
});

test('expireStaleSessions ends stale sessions inside a transaction', async () => {
  const statements = [];

  setHandler(async (sql) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/select id, classroom_id\s+from sessions/i.test(sql)) {
      return {
        rows: [
          { id: 'session-1', classroom_id: 'classroom-1' },
          { id: 'session-2', classroom_id: 'classroom-2' },
        ],
      };
    }
    return { rows: [] };
  });

  const result = await expireStaleSessions({ maxAgeHours: 4 });

  assert.equal(result.expired, 2);
  assert.ok(statements.includes('BEGIN'));
  assert.ok(statements.includes('COMMIT'));
  assert.ok(statements.some((s) => /update sessions/i.test(s) && /ended_at = now\(\)/i.test(s)));
  assert.ok(
    statements.some((s) => /update live_activities/i.test(s) && /attendance_pending = false/i.test(s))
  );
});

test('expireStaleSessions commits and reports zero when nothing is stale', async () => {
  const statements = [];

  setHandler(async (sql) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/select id, classroom_id/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const result = await expireStaleSessions();

  assert.equal(result.expired, 0);
  assert.ok(statements.includes('BEGIN'));
  assert.ok(statements.includes('COMMIT'));
});
