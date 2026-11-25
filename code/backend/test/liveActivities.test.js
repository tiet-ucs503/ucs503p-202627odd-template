const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const CLASSROOM = '31313131-3131-4131-8131-313131313131';
const PULSEMETER = '32323232-3232-4232-8232-323232323232';
const ACTIVITY = '33333333-3333-4333-8333-333333333333';
const RESPONSE = '34343434-3434-4434-8434-343434343434';

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
  io.events.length = 0;
});

const wordCloudActivity = {
  id: ACTIVITY,
  classroom_id: CLASSROOM,
  activity_ref_id: PULSEMETER,
  activity_type: 'PULSEMETER',
  status: 'ACTIVE',
  attendance_session_id: null,
  attendance_pending: false,
  pm_type: 'WORD_CLOUD',
  pm_config: { prompt: 'One word for today' },
  pm_title: 'Today',
  teacher_id: users.teacher.id,
};

function respondHandler() {
  return async (sql) => {
    if (/from live_activities la/i.test(sql) && /left join pulsemeters/i.test(sql)) {
      return { rows: [wordCloudActivity] };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'e' }] };
    if (/from word_cloud_mutes/i.test(sql)) return { rows: [] };
    if (/insert into pulsemeter_responses/i.test(sql)) return { rows: [] };
    if (/from pulsemeter_responses/i.test(sql) && /count\(\*\)::int as total/i.test(sql)) {
      return { rows: [{ total: 1, visible: 1, blocked: 0 }] };
    }
    if (/from pulsemeter_responses/i.test(sql) && /group by/i.test(sql)) {
      return { rows: [{ word: 'hello', count: 1 }] };
    }
    return { rows: [] };
  };
}

test('word-cloud responses longer than 60 characters are rejected', async () => {
  setHandler(respondHandler());

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'x'.repeat(61) },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Response is too long (max 60 characters).');
  assert.equal(
    calls.some((call) => /insert into pulsemeter_responses/i.test(call.sql)),
    false
  );
});

test('word-cloud responses of exactly 60 characters are accepted', async () => {
  setHandler(respondHandler());

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'x'.repeat(60) },
  });

  assert.equal(res.status, 201);
});

test('history uses linked attendance records for present_count and keeps enrolled_count', async () => {
  setHandler(async (sql) => {
    if (/select id, teacher_id from classrooms/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/select count\(\*\)::int as total from live_activities/i.test(sql)) {
      return { rows: [{ total: 1 }] };
    }
    if (/from live_activities la/i.test(sql) && /present_count/i.test(sql)) {
      return {
        rows: [
          {
            id: ACTIVITY,
            activity_type: 'PULSEMETER',
            status: 'ENDED',
            present_count: 7,
            enrolled_count: 25,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities?classroom_id=${CLASSROOM}`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.activities[0].present_count, 7);
  assert.equal(res.body.activities[0].enrolled_count, 25);

  const historyQuery = calls.find(
    (call) => /from live_activities la/i.test(call.sql) && /present_count/i.test(call.sql)
  );
  assert.ok(historyQuery);
  assert.match(historyQuery.sql, /attendance_records ar/i);
  assert.match(historyQuery.sql, /AS present_count/i);
  assert.match(historyQuery.sql, /AS enrolled_count/i);
});

test('deleting a response that does not exist returns 404', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) {
      return { rows: [wordCloudActivity] };
    }
    if (/delete from pulsemeter_responses/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [] };
  });

  const res = await request(
    base,
    'DELETE',
    `/live-activities/${ACTIVITY}/responses/${RESPONSE}`,
    { token: makeToken(users.teacher) }
  );

  assert.equal(res.status, 404);
  assert.match(res.body.error, /Response not found/);
});
