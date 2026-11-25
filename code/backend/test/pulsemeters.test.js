const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const CLASSROOM = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PULSEMETER = '12121212-1212-4212-8212-121212121212';
const ACTIVITY = '13131313-1313-4313-8313-131313131313';

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
};

function respondHandler(activity, { enrolled = true, muted = false, insertError = null } = {}) {
  return async (sql, params) => {
    if (/from live_activities la/i.test(sql) && /left join pulsemeters/i.test(sql)) {
      return { rows: [activity] };
    }
    if (/from enrollments/i.test(sql)) return { rows: enrolled ? [{ id: 'e' }] : [] };
    if (/from word_cloud_mutes/i.test(sql)) return { rows: muted ? [{ id: 'mute' }] : [] };
    if (/insert into pulsemeter_responses/i.test(sql)) {
      if (insertError) throw insertError;
      return { rows: [] };
    }
    if (/from pulsemeter_responses/i.test(sql) && /count\(\*\)::int as total/i.test(sql)) {
      return { rows: [{ total: 1, visible: 1, blocked: 0 }] };
    }
    if (/from pulsemeter_responses/i.test(sql) && /group by/i.test(sql)) {
      return { rows: [{ word: 'hello', count: 1, option_id: 'a', rating: '3' }] };
    }
    return { rows: [] };
  };
}

test('only teachers can author a PulseMeter', async () => {
  const res = await request(base, 'POST', '/pulsemeters', {
    token: makeToken(),
    body: { classroom_id: CLASSROOM, title: 'Poll', type: 'WORD_CLOUD' },
  });
  assert.equal(res.status, 403);
});

test('PulseMeter authoring rejects an unsupported type', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/pulsemeters', {
    token: makeToken(users.teacher),
    body: { classroom_id: CLASSROOM, title: 'Poll', type: 'ESSAY' },
  });
  assert.equal(res.status, 400);
});

test('an MCQ PulseMeter requires at least two options', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/pulsemeters', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: 'Poll',
      type: 'MCQ',
      config: { options: ['Only one'] },
    },
  });
  assert.equal(res.status, 400);
});

test('a rating scale must have min < max and stay within 1..10', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/pulsemeters', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: 'Poll',
      type: 'RATING_SCALE',
      config: { min: 5, max: 5 },
    },
  });
  assert.equal(res.status, 400);
});

test('a teacher can author a valid PulseMeter', async () => {
  setHandler(async (sql, params) => {
    if (/from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, section_name: '3CSE1' }] };
    }
    if (/insert into pulsemeters/i.test(sql)) {
      return {
        rows: [
          {
            id: PULSEMETER,
            classroom_id: params[0],
            created_by: params[1],
            title: params[2],
            type: params[3],
            config: params[4],
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/pulsemeters', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: '  Today  ',
      type: 'WORD_CLOUD',
      config: { prompt: '  One word  ' },
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.pulsemeter.title, 'Today');
  assert.equal(JSON.parse(res.body.pulsemeter.config).prompt, 'One word');
});

test('a teacher cannot list another teacher\'s PulseMeters', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'GET', `/pulsemeters?classroom_id=${CLASSROOM}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('a teacher cannot launch another teacher\'s PulseMeter', async () => {
  setHandler(async (sql) => {
    if (/from pulsemeters p/i.test(sql)) {
      return {
        rows: [
          {
            id: PULSEMETER,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            title: 'Poll',
            type: 'WORD_CLOUD',
            config: {},
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/pulsemeters/${PULSEMETER}/launch`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('launching while another activity is live returns 409', async () => {
  setHandler(async (sql) => {
    if (/from pulsemeters p/i.test(sql)) {
      return {
        rows: [
          {
            id: PULSEMETER,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            title: 'Poll',
            type: 'WORD_CLOUD',
            config: {},
          },
        ],
      };
    }
    if (/from sessions/i.test(sql)) return { rows: [{ id: 'session' }] };
    if (/insert into live_activities/i.test(sql)) {
      const error = new Error('duplicate key');
      error.constraint = 'one_active_activity_per_classroom';
      throw error;
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/pulsemeters/${PULSEMETER}/launch`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 409);
});

test('PulseMeter responses are student-only', async () => {
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(users.teacher),
    body: { response_value: 'hello' },
  });
  assert.equal(res.status, 403);
});

test('a student cannot respond to an ended PulseMeter', async () => {
  setHandler(respondHandler({ ...wordCloudActivity, status: 'ENDED' }));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'hello' },
  });
  assert.equal(res.status, 400);
});

test('a student outside the classroom cannot respond', async () => {
  setHandler(respondHandler(wordCloudActivity, { enrolled: false }));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'hello' },
  });
  assert.equal(res.status, 403);
});

test('a muted student cannot respond to a word cloud', async () => {
  setHandler(respondHandler(wordCloudActivity, { muted: true }));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'hello' },
  });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /muted/);
});

test('MCQ responses must use one of the configured option ids', async () => {
  const activity = {
    ...wordCloudActivity,
    pm_type: 'MCQ',
    pm_config: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
  };
  setHandler(respondHandler(activity));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'z' },
  });
  assert.equal(res.status, 400);
});

test('rating responses must be within the configured range', async () => {
  const activity = {
    ...wordCloudActivity,
    pm_type: 'RATING_SCALE',
    pm_config: { min: 1, max: 5 },
  };
  setHandler(respondHandler(activity));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 9 },
  });
  assert.equal(res.status, 400);
});

test('a valid word-cloud response is stored and broadcast to the teacher', async () => {
  setHandler(respondHandler(wordCloudActivity));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'hello' },
  });

  assert.equal(res.status, 201);
  const insert = calls.find((call) => /insert into pulsemeter_responses/i.test(call.sql));
  assert.ok(insert);
  assert.equal(insert.params[2], 'hello');
  assert.equal(insert.params[3], false);

  const event = io.events.find((e) => e.event === 'pulsemeter:results');
  assert.ok(event);
  assert.equal(event.room, `activity_${ACTIVITY}_teacher`);
});

test('profanity is auto-blocked but still recorded for teacher review', async () => {
  setHandler(respondHandler(wordCloudActivity));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'fuck' },
  });

  assert.equal(res.status, 201);
  const insert = calls.find((call) => /insert into pulsemeter_responses/i.test(call.sql));
  assert.equal(insert.params[3], true);
  assert.match(insert.params[4], /profanity/i);
});

test('duplicate PulseMeter responses are rejected with 409', async () => {
  const unique = new Error('duplicate key');
  unique.constraint = 'pulsemeter_responses_live_activity_id_student_id_key';
  setHandler(respondHandler(wordCloudActivity, { insertError: unique }));

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/respond`, {
    token: makeToken(),
    body: { response_value: 'hello' },
  });
  assert.equal(res.status, 409);
});

test('a teacher cannot read analytics for another teacher\'s PulseMeter', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) {
      return { rows: [{ ...wordCloudActivity, teacher_id: users.teacher.id }] };
    }
    return { rows: [] };
  });
  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/analytics`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('launching a PulseMeter ignores an ended session outside the attendance window', async () => {
  let launchInsert = null;
  setHandler(async (sql, params) => {
    if (/from pulsemeters p/i.test(sql)) {
      return {
        rows: [
          {
            id: PULSEMETER,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            title: 'Poll',
            type: 'WORD_CLOUD',
            config: {},
          },
        ],
      };
    }
    if (/from sessions/i.test(sql)) return { rows: [] };
    if (/insert into live_activities/i.test(sql)) {
      launchInsert = { sql, params };
      return {
        rows: [
          {
            id: ACTIVITY,
            classroom_id: params[0],
            activity_type: 'PULSEMETER',
            activity_ref_id: params[1],
            status: 'ACTIVE',
            started_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/pulsemeters/${PULSEMETER}/launch`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.attendancePending, true);
  assert.ok(launchInsert);
  assert.equal(launchInsert.params[2], null);
  assert.equal(launchInsert.params[3], true);

  const sessionQuery = calls.find((call) => /from sessions/i.test(call.sql));
  assert.ok(sessionQuery);
  assert.match(sessionQuery.sql, /ended_at > now\(\) -/i);
  assert.equal(sessionQuery.params[1], '12');
});

test('mute reasons are trimmed and capped at 500 characters', async () => {
  setHandler(async (sql, params) => {
    if (/from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'e' }] };
    if (/insert into word_cloud_mutes/i.test(sql)) {
      return { rows: [{ id: 'mute-1', reason: params[3] }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/word-cloud-mutes', {
    token: makeToken(users.teacher),
    body: {
      student_id: users.student.id,
      classroom_id: CLASSROOM,
      duration_days: 7,
      reason: `   ${'x'.repeat(600)}   `,
    },
  });

  assert.equal(res.status, 201);
  const insert = calls.find((call) => /insert into word_cloud_mutes/i.test(call.sql));
  assert.ok(insert);
  assert.equal(insert.params[3].length, 500);
  assert.equal(insert.params[3], 'x'.repeat(500));
});

test('a teacher cannot remove a mute owned by another classroom', async () => {
  setHandler(async (sql) => {
    if (/from word_cloud_mutes m/i.test(sql)) {
      return {
        rows: [{ id: 'mute-1', classroom_id: CLASSROOM, teacher_id: users.teacher.id }],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', '/word-cloud-mutes/mute-1', {
    token: makeToken(users.otherTeacher),
  });

  assert.equal(res.status, 403);
});

test('the owning teacher can remove a mute by id', async () => {
  setHandler(async (sql) => {
    if (/from word_cloud_mutes m/i.test(sql)) {
      return {
        rows: [{ id: 'mute-1', classroom_id: CLASSROOM, teacher_id: users.teacher.id }],
      };
    }
    if (/delete from word_cloud_mutes/i.test(sql)) {
      return { rows: [{ id: 'mute-1' }], rowCount: 1 };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', '/word-cloud-mutes/mute-1', {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.match(res.body.message, /Mute removed successfully/);
});

test('the owning teacher can remove a mute by student and classroom', async () => {
  setHandler(async (sql) => {
    if (/from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/delete from word_cloud_mutes/i.test(sql)) {
      return { rows: [{ id: 'mute-1' }], rowCount: 1 };
    }
    return { rows: [] };
  });

  const res = await request(
    base,
    'DELETE',
    `/word-cloud-mutes?student_id=${users.student.id}&classroom_id=${CLASSROOM}`,
    { token: makeToken(users.teacher) }
  );

  assert.equal(res.status, 200);
  assert.match(res.body.message, /Mute removed successfully/);
});
