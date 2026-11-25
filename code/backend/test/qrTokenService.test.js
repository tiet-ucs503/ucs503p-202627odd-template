const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

require('./helpers/mockDb');
const { fakeRedis, resetRedis } = require('./helpers/mockRedis');
const { setHandler, reset } = require('./helpers/mockDb');
const { users } = require('./helpers/token');

const {
  generate3QrSequence,
  validateAndMarkAttendance,
  TOKEN_TTL_SECONDS,
  MAX_TOKEN_AGE_MS,
  BATCH_REUSE_MS,
} = require('../src/services/qrTokenService');

const SESSION = '55555555-5555-4555-8555-555555555555';
const CLASSROOM = '66666666-6666-4666-8666-666666666666';

function hmac(payload) {
  return crypto
    .createHmac('sha256', process.env.QR_HMAC_SECRET)
    .update(payload)
    .digest('hex');
}

function forgeBatch(sessionId, { timestamp = Date.now(), batchId = 'batch-test' } = {}) {
  const tokens = [0, 1, 2].map((index) => {
    const tokenId = `token-${index}`;
    return {
      session_id: sessionId,
      batch_id: batchId,
      seq_idx: index,
      timestamp,
      token_id: tokenId,
      hash: hmac(`${sessionId}:${batchId}:${index}:${timestamp}:${tokenId}`),
    };
  });
  return { batchId, timestamp, tokens };
}

// Re-sign an existing cached batch with an older timestamp so freshness/ACL
// calculations can be tested without sleeping.
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

function sessionHandler({ ended = false, enrolled = true, duplicate = false } = {}) {
  return async (sql, params) => {
    if (/from sessions where id/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            started_at: new Date(),
            ended_at: ended ? new Date() : null,
          },
        ],
      };
    }
    if (/from enrollments/i.test(sql)) {
      return { rows: enrolled ? [{ id: 'enrollment-1' }] : [] };
    }
    if (/from attendance_records/i.test(sql)) {
      return { rows: duplicate ? [{ id: 'attendance-existing' }] : [] };
    }
    if (/insert into attendance_records/i.test(sql)) {
      return {
        rows: [
          {
            id: 'attendance-new',
            session_id: SESSION,
            student_id: users.student.id,
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

beforeEach(() => {
  reset();
  resetRedis();
});

test('generate3QrSequence reuses the latest cached batch while it is fresh', async () => {
  const first = await generate3QrSequence(SESSION);
  const second = await generate3QrSequence(SESSION);

  assert.equal(second.batch_id, first.batch_id);
  assert.deepEqual(second.tokens, first.tokens);
  assert.ok(second.expires_in_seconds <= TOKEN_TTL_SECONDS);

  const third = await generate3QrSequence(SESSION, { maxAgeMs: 0 });
  assert.notEqual(third.batch_id, first.batch_id);
});

test('batch reuse window leaves a safe margin below the 10s freshness limit', async () => {
  assert.ok(BATCH_REUSE_MS < MAX_TOKEN_AGE_MS);

  const batch = await generate3QrSequence(SESSION);
  // Simulate a batch that is already inside the final expiry margin. Even when
  // a caller asks for a large reuse window, it must not be handed out again.
  const staleTimestamp = Date.now() - (MAX_TOKEN_AGE_MS - 500);
  const stale = ageBatch(batch, staleTimestamp);
  await fakeRedis.set(
    `session:${SESSION}:batch:${batch.batch_id}`,
    JSON.stringify(stale)
  );
  await fakeRedis.set(`session:${SESSION}:latest_batch`, batch.batch_id);

  const next = await generate3QrSequence(SESSION, { maxAgeMs: MAX_TOKEN_AGE_MS });
  assert.notEqual(next.batch_id, batch.batch_id);
  assert.equal(next.fresh_for_ms, MAX_TOKEN_AGE_MS);
});

test('generate3QrSequence returns exactly three signed, ordered frames', async () => {
  const batch = await generate3QrSequence(SESSION);

  assert.equal(batch.tokens.length, 3);
  assert.equal(batch.expires_in_seconds, Math.ceil(MAX_TOKEN_AGE_MS / 1000));
  assert.equal(batch.fresh_for_ms, MAX_TOKEN_AGE_MS);
  assert.equal(new Set(batch.tokens.map((t) => t.batch_id)).size, 1);
  assert.deepEqual(batch.tokens.map((t) => t.seq_idx), [0, 1, 2]);

  for (const token of batch.tokens) {
    assert.equal(token.session_id, SESSION);
    assert.equal(
      token.hash,
      hmac(`${SESSION}:${batch.batch_id}:${token.seq_idx}:${token.timestamp}:${token.token_id}`)
    );
    const parsed = JSON.parse(token.qr_payload);
    assert.equal(parsed.s, SESSION);
    assert.equal(parsed.i, token.seq_idx);
  }

  const cached = await fakeRedis.get(`session:${SESSION}:batch:${batch.batch_id}`);
  assert.ok(cached);
});

test('a valid 3-frame scan marks attendance PRESENT', async () => {
  const batch = await generate3QrSequence(SESSION);
  const timestamp = Date.now() - 3000;
  const aged = ageBatch(batch, timestamp);
  setHandler(sessionHandler());

  const scanStartedAt = new Date(timestamp + 1000).toISOString();
  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: aged.tokens,
    scanStartedAt,
    studentId: users.student.id,
  });

  assert.equal(result.valid, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.record.status, 'PRESENT');
  assert.ok(result.acl_ms >= 1500, `expected ACL >= 1500ms, got ${result.acl_ms}`);
});

test('a scan with fewer than three frames is rejected', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens.slice(0, 2),
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /Exactly 3 rotating tokens/);
});

test('out-of-order frames are rejected', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());
  const shuffled = [batch.tokens[0], batch.tokens[2], batch.tokens[1]];

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: shuffled,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /Sequence ordering violation/);
});

test('frames from different batches are rejected', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());
  const mixed = batch.tokens.map((token) => ({ ...token }));
  mixed[2].batch_id = 'different-batch';

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: mixed,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /batch mismatch/i);
});

test('a tampered frame fails HMAC verification', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());
  const tampered = batch.tokens.map((token) => ({ ...token }));
  tampered[1].token_id = 'evil-token';

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: tampered,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /HMAC signature/);
});

test('an expired frame batch is rejected when it is older than the freshness window', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());

  // Keep the HMAC valid, but move the signed timestamp outside the window.
  const timestamp = Date.now() - MAX_TOKEN_AGE_MS - 1000;
  const oldTokens = batch.tokens.map((token, index) => ({
    ...token,
    timestamp,
    hash: hmac(`${SESSION}:${token.batch_id}:${index}:${timestamp}:${token.token_id}`),
  }));

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: oldTokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /Token expired/);
});

test('a cryptographically valid batch that Redis never saw is rejected', async () => {
  const forged = forgeBatch(SESSION);
  setHandler(sessionHandler());

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: forged.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /no longer active in Redis/);
});

test('scans are rejected after the session has ended', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler({ ended: true }));

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /already ended/);
});

test('scans are rejected for students not enrolled in the classroom', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler({ enrolled: false }));

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 403);
});

test('duplicate attendance is rejected with 409', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler({ duplicate: true }));

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 409);
});

test('a scan_started_at more than two seconds in the future is rejected', async () => {
  const batch = await generate3QrSequence(SESSION);
  setHandler(sessionHandler());

  const future = new Date(Date.now() + 60_000).toISOString();
  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    scanStartedAt: future,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /Invalid scan_started_at/);
});

test('ACL is bounded by the server-signed token timestamp', async () => {
  const batch = await generate3QrSequence(SESSION);
  const timestamp = Date.now() - 5000;
  const aged = ageBatch(batch, timestamp);
  setHandler(sessionHandler());

  // The client claims the scan began even before the server issued the QR.
  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: aged.tokens,
    scanStartedAt: new Date(timestamp - 4000).toISOString(),
    studentId: users.student.id,
  });

  assert.equal(result.valid, true);
  assert.ok(result.acl_ms >= 4000, `expected ACL >= 4000ms, got ${result.acl_ms}`);
  assert.equal(new Date(result.record.scan_started_at).getTime(), timestamp);
});

test('a concurrent duplicate insert returns 409 instead of throwing', async () => {
  const batch = await generate3QrSequence(SESSION);
  const handler = sessionHandler();
  setHandler(async (sql, params) => {
    if (/insert into attendance_records/i.test(sql)) {
      const error = new Error('duplicate key value violates unique constraint');
      error.constraint = 'attendance_records_session_id_student_id_key';
      throw error;
    }
    return handler(sql, params);
  });

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 409);
});

test('a PostgreSQL 23505 duplicate insert also returns 409', async () => {
  const batch = await generate3QrSequence(SESSION);
  const handler = sessionHandler();
  setHandler(async (sql, params) => {
    if (/insert into attendance_records/i.test(sql)) {
      const error = new Error('duplicate key value violates unique constraint');
      error.code = '23505';
      throw error;
    }
    return handler(sql, params);
  });

  const result = await validateAndMarkAttendance({
    sessionId: SESSION,
    tokens: batch.tokens,
    studentId: users.student.id,
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 409);
});
