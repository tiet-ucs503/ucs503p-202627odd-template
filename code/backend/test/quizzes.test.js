const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const CLASSROOM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const QUIZ = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTIVITY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const QUESTION = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
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
  io.events.length = 0;
});

const question = {
  id: QUESTION,
  quiz_id: QUIZ,
  question_text: 'What is 2 + 2?',
  options: [
    { id: 'a', text: '4' },
    { id: 'b', text: '5' },
  ],
  correct_option_id: 'a',
  order_index: 0,
  time_limit_seconds: 20,
};

function quizActivity(overrides = {}) {
  return {
    id: ACTIVITY,
    classroom_id: CLASSROOM,
    activity_ref_id: QUIZ,
    activity_type: 'QUIZ',
    status: 'ACTIVE',
    scoring_mode: 'WIDE',
    title_snapshot: 'Test Quiz',
    config_snapshot: { scoring_mode: 'WIDE', questions: [question] },
    attendance_pending: false,
    attendance_session_id: null,
    teacher_id: users.teacher.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    ...overrides,
  };
}

function answerHandler({
  correct = true,
  state = null,
  latest = null,
  enrolled = true,
  insertError = null,
} = {}) {
  return async (sql, params) => {
    if (/from live_activities la/i.test(sql) && /left join quizzes/i.test(sql)) {
      return { rows: [quizActivity()] };
    }
    if (/from enrollments/i.test(sql)) return { rows: enrolled ? [{ id: 'e' }] : [] };
    if (/from quiz_questions where id/i.test(sql)) {
      return { rows: [{ ...question, correct_option_id: correct ? 'a' : 'a' }] };
    }
    if (/from activity_question_states/i.test(sql) && /question_id = \$2/i.test(sql)) {
      return { rows: state ? [state] : [] };
    }
    if (/from activity_question_states/i.test(sql) && /order by started_at_ms desc/i.test(sql)) {
      return { rows: latest ? [latest] : [] };
    }
    if (/insert into quiz_responses/i.test(sql)) {
      if (insertError) throw insertError;
      return { rows: [] };
    }
    if (/count\(\*\)::int as total from quiz_responses/i.test(sql)) {
      return { rows: [{ total: 1 }] };
    }
    return { rows: [] };
  };
}

test('only teachers can author a quiz', async () => {
  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(),
    body: { classroom_id: CLASSROOM, title: 'Quiz', questions: [question] },
  });
  assert.equal(res.status, 403);
});

test('quiz authoring rejects an empty question list', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(users.teacher),
    body: { classroom_id: CLASSROOM, title: 'Quiz', questions: [] },
  });
  assert.equal(res.status, 400);
});

test('quiz authoring rejects an unsupported scoring mode', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: 'Quiz',
      scoring_mode: 'CHAOS',
      questions: [question],
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /WIDE.*NARROW/);
});

test('quiz authoring rejects an unknown correct option', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: 'Quiz',
      questions: [{ ...question, correct_option_id: 'z' }],
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /valid correct_option_id/);
});

test('quiz authoring rejects an out-of-range time limit', async () => {
  setHandler(async () => ({ rows: [{ id: CLASSROOM }] }));
  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: 'Quiz',
      questions: [{ ...question, time_limit_seconds: 500 }],
    },
  });
  assert.equal(res.status, 400);
});

test('quiz authoring creates the quiz and all questions in a transaction', async () => {
  const statements = [];
  setHandler(async (sql, params) => {
    const upper = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    statements.push(upper);
    if (/select id, section_name from classrooms/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, section_name: '3CSE1' }] };
    }
    if (/insert into quizzes/i.test(sql)) {
      return {
        rows: [
          {
            id: QUIZ,
            classroom_id: params[0],
            created_by: params[1],
            title: params[2],
            scoring_mode: params[3],
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (/insert into quiz_questions/i.test(sql)) {
      return {
        rows: [
          {
            id: QUESTION,
            quiz_id: QUIZ,
            question_text: params[1],
            options: params[2],
            correct_option_id: params[3],
            order_index: params[4],
            time_limit_seconds: params[5],
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/quizzes', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      title: '  Test Quiz  ',
      scoring_mode: 'narrow',
      questions: [question],
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.quiz.title, 'Test Quiz');
  assert.equal(res.body.quiz.scoring_mode, 'NARROW');
  assert.equal(res.body.quiz.questions.length, 1);
  assert.ok(statements.includes('BEGIN'));
  assert.ok(statements.includes('COMMIT'));
});

test('an unrelated teacher cannot launch someone else\'s quiz', async () => {
  setHandler(async (sql) => {
    if (/from quizzes q/i.test(sql)) {
      return { rows: [quizActivity()] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/quizzes/${QUIZ}/launch`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('launching a quiz with no questions is rejected', async () => {
  setHandler(async (sql) => {
    if (/from quizzes q/i.test(sql)) return { rows: [quizActivity()] };
    if (/from quiz_questions/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/quizzes/${QUIZ}/launch`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 400);
});

test('launching while another activity is live returns 409', async () => {
  setHandler(async (sql) => {
    if (/from quizzes q/i.test(sql)) return { rows: [quizActivity()] };
    if (/from quiz_questions/i.test(sql)) return { rows: [question] };
    if (/from sessions/i.test(sql)) return { rows: [] };
    if (/insert into live_activities/i.test(sql)) {
      const error = new Error('duplicate key');
      error.constraint = 'one_active_activity_per_classroom';
      throw error;
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/quizzes/${QUIZ}/launch`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 409);
});

test('launching a quiz broadcasts questions without the correct answers', async () => {
  setHandler(async (sql, params) => {
    if (/from quizzes q/i.test(sql)) return { rows: [quizActivity()] };
    if (/from quiz_questions/i.test(sql)) return { rows: [question] };
    if (/from sessions/i.test(sql)) return { rows: [] };
    if (/insert into live_activities/i.test(sql)) {
      return {
        rows: [
          {
            id: ACTIVITY,
            classroom_id: params[0],
            activity_type: 'QUIZ',
            activity_ref_id: params[1],
            status: 'ACTIVE',
            started_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/quizzes/${QUIZ}/launch`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.activity.id, ACTIVITY);

  const broadcast = io.events.find((e) => e.event === 'activity:launched');
  assert.ok(broadcast);
  assert.equal(broadcast.payload.quiz.questions[0].correct_option_id, undefined);
  assert.equal(broadcast.payload.quiz.questions[0].question_text, question.question_text);
});

test('quiz answers reject teachers', async () => {
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(users.teacher),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });
  assert.equal(res.status, 403);
});

test('quiz answers reject students who are not enrolled', async () => {
  const now = Date.now();
  setHandler(
    answerHandler({
      state: {
        live_activity_id: ACTIVITY,
        question_id: QUESTION,
        started_at_ms: now - 500,
        ends_at_ms: now + 10_000,
        revealed: false,
      },
      latest: null,
      enrolled: false,
    })
  );

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });
  assert.equal(res.status, 403);
});

test('quiz answers reject options that are not in the question', async () => {
  setHandler(answerHandler());
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'z' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Invalid option/);
});

test('quiz answers are rejected when no question is open', async () => {
  setHandler(answerHandler({ state: null, latest: null }));
  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });
  assert.equal(res.status, 409);
});

test('quiz answers are rejected after the timer expires', async () => {
  const now = Date.now();
  setHandler(
    answerHandler({
      state: {
        live_activity_id: ACTIVITY,
        question_id: QUESTION,
        started_at_ms: now - 30_000,
        ends_at_ms: now - 1_000,
        revealed: false,
      },
      latest: {
        live_activity_id: ACTIVITY,
        question_id: QUESTION,
        started_at_ms: now - 30_000,
        ends_at_ms: now - 1_000,
        revealed: false,
      },
    })
  );

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Time limit/);
});

test('a correct WIDE answer receives the time-weighted score', async () => {
  const now = Date.now();
  const state = {
    live_activity_id: ACTIVITY,
    question_id: QUESTION,
    started_at_ms: now - 5_000,
    ends_at_ms: now + 15_000,
    revealed: false,
  };
  setHandler(answerHandler({ state, latest: state }));

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'A' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.is_correct, true);

  const insert = calls.find((call) => /insert into quiz_responses/i.test(call.sql));
  assert.ok(insert);
  const responseTimeMs = insert.params[5];
  const awarded = insert.params[6];
  const timeLimitSeconds = (state.ends_at_ms - state.started_at_ms) / 1000;
  const fraction = Math.max(0, Math.min(1, (timeLimitSeconds - responseTimeMs / 1000) / timeLimitSeconds));
  assert.equal(awarded, Math.round(300 + 700 * fraction));
  assert.equal(res.body.score_awarded, awarded);
});

test('a correct NARROW answer uses the 700-1000 score band', async () => {
  const now = Date.now();
  const state = {
    live_activity_id: ACTIVITY,
    question_id: QUESTION,
    started_at_ms: now - 5_000,
    ends_at_ms: now + 15_000,
    revealed: false,
  };
  setHandler(async (sql, params) => {
    if (/from live_activities la/i.test(sql) && /left join quizzes/i.test(sql)) {
      return { rows: [quizActivity({ scoring_mode: 'NARROW' })] };
    }
    return answerHandler({ state, latest: state })(sql, params);
  });

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.score_awarded >= 700);
  assert.ok(res.body.score_awarded <= 1000);
});

test('an incorrect answer receives zero points', async () => {
  const now = Date.now();
  const state = {
    live_activity_id: ACTIVITY,
    question_id: QUESTION,
    started_at_ms: now - 5_000,
    ends_at_ms: now + 15_000,
    revealed: false,
  };
  setHandler(answerHandler({ state, latest: state }));

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'b' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.is_correct, false);
  assert.equal(res.body.score_awarded, 0);
});

test('duplicate quiz answers are rejected with 409', async () => {
  const now = Date.now();
  const state = {
    live_activity_id: ACTIVITY,
    question_id: QUESTION,
    started_at_ms: now,
    ends_at_ms: now + 20_000,
    revealed: false,
  };
  const unique = new Error('duplicate key');
  unique.constraint = 'quiz_responses_live_activity_id_question_id_student_id_key';
  setHandler(answerHandler({ state, latest: state, insertError: unique }));

  const res = await request(base, 'POST', `/live-activities/${ACTIVITY}/quiz/answer`, {
    token: makeToken(),
    body: { question_id: QUESTION, selected_option_id: 'a' },
  });
  assert.equal(res.status, 409);
});

test('students cannot see other students\' email addresses on the leaderboard', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql) && /left join quizzes/i.test(sql)) {
      return { rows: [quizActivity()] };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'e' }] };
    if (/from quiz_responses qr/i.test(sql) && /group by qr.student_id/i.test(sql)) {
      return {
        rows: [
          {
            student_id: STUDENT,
            student_name: 'Test Student',
            student_email: 'student@example.com',
            total_score: 900,
            correct_count: 1,
            total_answered: 1,
            avg_response_time_ms: 1000,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/leaderboard`, {
    token: makeToken(),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.leaderboard[0].student_email, undefined);
});

test('quiz state keeps an expired but un-revealed question hidden', async () => {
  const now = Date.now();
  const state = {
    live_activity_id: ACTIVITY,
    question_id: QUESTION,
    started_at_ms: now - 30_000,
    ends_at_ms: now - 1_000,
    revealed: false,
  };
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql) && /left join quizzes/i.test(sql)) {
      return { rows: [quizActivity()] };
    }
    if (/from activity_question_states/i.test(sql) && /order by started_at_ms desc/i.test(sql)) {
      return { rows: [state] };
    }
    if (/from quiz_responses/i.test(sql) && /count\(\*\)::int as total/i.test(sql)) {
      return { rows: [{ total: 2 }] };
    }
    if (/from quiz_responses qr/i.test(sql) && /group by qr.student_id/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stage, 'QUESTION_ACTIVE');
  assert.equal(res.body.current_question.revealed, false);
  assert.equal(res.body.current_question.time_expired, true);
  assert.equal(res.body.current_question.correct_option_id, null);
  assert.equal(res.body.answered_count, 2);
});

test('my-results does not leak correct answers for un-revealed questions', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'e' }] };
    if (/from activity_question_states/i.test(sql)) {
      return {
        rows: [{ question_id: QUESTION, revealed: false }],
      };
    }
    if (/from quiz_responses/i.test(sql) && /student_id = \$2/i.test(sql)) return { rows: [] };
    if (/from quiz_responses qr/i.test(sql) && /group by qr.student_id/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/my-results`, {
    token: makeToken(),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.questions[0].correct_option_id, null);
});

test('my-results exposes the correct answer only after the question is revealed', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'e' }] };
    if (/from activity_question_states/i.test(sql)) {
      return {
        rows: [{ question_id: QUESTION, revealed: true }],
      };
    }
    if (/from quiz_responses/i.test(sql) && /student_id = \$2/i.test(sql)) return { rows: [] };
    if (/from quiz_responses qr/i.test(sql) && /group by qr.student_id/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/my-results`, {
    token: makeToken(),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.questions[0].correct_option_id, 'a');
});

test('quiz state requires the owning teacher', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.otherTeacher),
  });

  assert.equal(res.status, 403);
});

test('quiz state returns LOBBY when no question has been started', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    if (/from activity_question_states/i.test(sql)) return { rows: [] };
    if (/from quiz_responses qr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stage, 'LOBBY');
  assert.equal(res.body.current_question, null);
  assert.equal(res.body.question_count, 1);
});

test('quiz state reports an active question without leaking the correct answer', async () => {
  const now = Date.now();
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    if (/from activity_question_states/i.test(sql)) {
      return {
        rows: [
          {
            live_activity_id: ACTIVITY,
            question_id: QUESTION,
            started_at_ms: now - 1000,
            ends_at_ms: now + 10_000,
            revealed: false,
          },
        ],
      };
    }
    if (/count\(\*\)::int as total[\s\S]*from quiz_responses/i.test(sql)) {
      return { rows: [{ total: 4 }] };
    }
    if (/from quiz_responses qr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stage, 'QUESTION_ACTIVE');
  assert.equal(res.body.current_question.question_id, QUESTION);
  assert.equal(res.body.current_question.correct_option_id, null);
  assert.equal(res.body.answered_count, 4);
});

test('quiz state reports QUESTION_RESULTS and the correct answer after reveal', async () => {
  const now = Date.now();
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) return { rows: [quizActivity()] };
    if (/from activity_question_states/i.test(sql)) {
      return {
        rows: [
          {
            live_activity_id: ACTIVITY,
            question_id: QUESTION,
            started_at_ms: now - 20_000,
            ends_at_ms: now - 1000,
            revealed: true,
          },
        ],
      };
    }
    if (/count\(\*\)::int as total[\s\S]*from quiz_responses/i.test(sql)) {
      return { rows: [{ total: 2 }] };
    }
    if (/from quiz_responses qr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stage, 'QUESTION_RESULTS');
  assert.equal(res.body.current_question.revealed, true);
  assert.equal(res.body.current_question.correct_option_id, 'a');
});

test('quiz state reports FINAL_LEADERBOARD for an ended quiz', async () => {
  setHandler(async (sql) => {
    if (/from live_activities la/i.test(sql)) {
      return { rows: [quizActivity({ status: 'ENDED' })] };
    }
    if (/from quiz_responses qr/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/live-activities/${ACTIVITY}/quiz/state`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stage, 'FINAL_LEADERBOARD');
  assert.equal(res.body.status, 'ENDED');
});

test('launching a quiz ignores an ended session outside the attendance window', async () => {
  let launchInsert = null;
  setHandler(async (sql, params) => {
    if (/from quizzes q/i.test(sql)) return { rows: [quizActivity()] };
    if (/from quiz_questions/i.test(sql)) return { rows: [question] };
    if (/from sessions/i.test(sql)) return { rows: [] };
    if (/insert into live_activities/i.test(sql)) {
      launchInsert = { sql, params };
      return {
        rows: [
          {
            id: ACTIVITY,
            classroom_id: params[0],
            activity_type: 'QUIZ',
            activity_ref_id: params[1],
            status: 'ACTIVE',
            started_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', `/quizzes/${QUIZ}/launch`, {
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
