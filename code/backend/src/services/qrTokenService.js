const crypto = require('crypto');
const db = require('../db');
const { getRedisClient } = require('../redis');

const HMAC_SECRET = process.env.QR_HMAC_SECRET;
if (!HMAC_SECRET) {
  throw new Error('QR_HMAC_SECRET is required. Refusing to start with a default QR signing secret.');
}
const TOKEN_TTL_SECONDS = 15;
const MAX_TOKEN_AGE_MS = 10000; // 10s freshness window per technical specification
// How long an already-created batch may be reused when a client asks for the
// current tokens. This must not align with the client's polling interval: when
// it was 8s and the client also polled every 8s, a poll landing a few
// milliseconds early reused an almost-expired batch, which then stayed on
// screen for another full interval (up to ~16s old) and was rejected by the
// server's 10s freshness check.
const BATCH_REUSE_MS = 4000;
// Never hand out a batch that is already within this margin of expiry, even
// if a caller explicitly asks for a larger reuse window.
const MIN_FRESHNESS_MARGIN_MS = 1000;

// Helper to compute HMAC-SHA256 signature
function computeHmac(payloadString) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payloadString).digest('hex');
}

/**
 * Generates a signed, timestamped 3-QR token batch for an active session.
 * Reuses the latest cached batch while it is still within `maxAgeMs` so that
 * polling `/sessions/:id/active-tokens` does not rotate the QR codes on every
 * request (which would make scanning impossible for students).
 *
 * @param {string} sessionId
 * @param {{ maxAgeMs?: number }} [options]
 * @returns {Promise<{ batch_id: string, timestamp: number, expires_in_seconds: number, fresh_for_ms: number, tokens: Array }>}
 */
async function generate3QrSequence(sessionId, options = {}) {
  const redis = getRedisClient();
  const parsedMaxAge = Number(options.maxAgeMs);
  const requestedMaxAge =
    Number.isFinite(parsedMaxAge) && parsedMaxAge >= 0 ? parsedMaxAge : BATCH_REUSE_MS;
  const maxAgeMs = Math.min(requestedMaxAge, MAX_TOKEN_AGE_MS - MIN_FRESHNESS_MARGIN_MS);

  // Reuse the most recent batch while it is still fresh.
  const latestBatchId = await redis.get(`session:${sessionId}:latest_batch`);
  if (latestBatchId) {
    const cachedRaw = await redis.get(`session:${sessionId}:batch:${latestBatchId}`);
    if (cachedRaw) {
      try {
        const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
        const cachedTimestamp = Number(cached && cached.timestamp);
        const ageMs = Date.now() - cachedTimestamp;

        if (
          Number.isFinite(cachedTimestamp) &&
          ageMs >= 0 &&
          ageMs < maxAgeMs &&
          Array.isArray(cached.tokens) &&
          cached.tokens.length === 3
        ) {
          return {
            batch_id: cached.batchId || cached.batch_id || latestBatchId,
            timestamp: cachedTimestamp,
            expires_in_seconds: Math.ceil(
              Math.max(0, MAX_TOKEN_AGE_MS - ageMs) / 1000
            ),
            fresh_for_ms: Math.max(0, MAX_TOKEN_AGE_MS - ageMs),
            tokens: cached.tokens,
          };
        }
      } catch (parseErr) {
        // Corrupt cache entry: fall through and issue a fresh batch.
      }
    }
  }

  const batchId = crypto.randomUUID();
  const timestamp = Date.now();

  const tokens = [];
  for (let seqIdx = 0; seqIdx < 3; seqIdx++) {
    const tokenId = crypto.randomBytes(6).toString('hex');
    const signaturePayload = `${sessionId}:${batchId}:${seqIdx}:${timestamp}:${tokenId}`;
    const hash = computeHmac(signaturePayload);

    // Compact QR string payload for low-density, high-readability QR codes
    const compactPayload = JSON.stringify({
      s: sessionId,
      b: batchId,
      i: seqIdx,
      t: timestamp,
      k: tokenId,
      h: hash,
    });

    tokens.push({
      session_id: sessionId,
      batch_id: batchId,
      seq_idx: seqIdx,
      timestamp,
      token_id: tokenId,
      hash,
      qr_payload: compactPayload,
    });
  }

  // Cache in Redis with a 15-second expiration (5s grace beyond the 10s
  // freshness check so in-flight scans are not rejected by cache eviction).
  const redisKey = `session:${sessionId}:batch:${batchId}`;
  await redis.set(redisKey, JSON.stringify({ batchId, timestamp, tokens }), 'EX', TOKEN_TTL_SECONDS);
  await redis.set(`session:${sessionId}:latest_batch`, batchId, 'EX', TOKEN_TTL_SECONDS);

  return {
    batch_id: batchId,
    timestamp,
    expires_in_seconds: Math.ceil(MAX_TOKEN_AGE_MS / 1000),
    fresh_for_ms: MAX_TOKEN_AGE_MS,
    tokens,
  };
}

/**
 * Validates a submitted 3-QR token sequence and marks attendance
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {Array} params.tokens
 * @param {string|Date} params.scanStartedAt
 * @param {string} params.studentId
 */
async function validateAndMarkAttendance({ sessionId, tokens, scanStartedAt, studentId }) {
  const validatedAt = new Date();

  // 1. Structure check: must have exactly 3 tokens
  if (!Array.isArray(tokens) || tokens.length !== 3) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Invalid scan sequence: Exactly 3 rotating tokens are required.',
    };
  }

  // Normalize tokens to support both compact ({s, b, i, t, k, h}) and standard format
  const normalizedTokens = tokens.map((t) => ({
    session_id: t.session_id || t.s,
    batch_id: t.batch_id || t.b,
    seq_idx: t.seq_idx !== undefined ? Number(t.seq_idx) : (t.i !== undefined ? Number(t.i) : -1),
    timestamp: Number(t.timestamp || t.t || 0),
    token_id: t.token_id || t.k || '',
    hash: t.hash || t.h || '',
  }));

  // 2. Sequence ordering check: index 0, 1, 2
  for (let i = 0; i < 3; i++) {
    if (normalizedTokens[i].seq_idx !== i) {
      return {
        valid: false,
        statusCode: 400,
        error: `Sequence ordering violation: Expected token index ${i}, received ${normalizedTokens[i].seq_idx}.`,
      };
    }
  }

  const batchId = normalizedTokens[0].batch_id;
  const tokenTimestamp = Number(normalizedTokens[0].timestamp);

  // 3. Consistency check across tokens
  for (let i = 0; i < 3; i++) {
    if (normalizedTokens[i].batch_id !== batchId || normalizedTokens[i].session_id !== sessionId) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Token batch mismatch: Tokens belong to different batches or sessions.',
      };
    }
  }

  // 4. Freshness check: <= 10 seconds age
  const now = Date.now();
  const tokenAgeMs = now - tokenTimestamp;
  if (tokenAgeMs > MAX_TOKEN_AGE_MS || tokenAgeMs < -2000) { // allow 2s clock drift
    return {
      valid: false,
      statusCode: 400,
      error: `Token expired: QR code is ${Math.round(tokenAgeMs / 1000)}s old (max allowed freshness is 10s).`,
    };
  }

  // 5. Cryptographic signature check (HMAC-SHA256)
  for (let i = 0; i < 3; i++) {
    const signaturePayload = `${sessionId}:${batchId}:${i}:${normalizedTokens[i].timestamp}:${normalizedTokens[i].token_id}`;
    const expectedHash = computeHmac(signaturePayload);

    if (normalizedTokens[i].hash !== expectedHash) {
      return {
        valid: false,
        statusCode: 400,
        error: `Cryptographic verification failed: Token at index ${i} has an invalid HMAC signature.`,
      };
    }
  }

  // 6. Redis active token check
  const redis = getRedisClient();
  const redisKey = `session:${sessionId}:batch:${batchId}`;
  const cachedBatch = await redis.get(redisKey);
  if (!cachedBatch) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Token no longer active in Redis cache: QR code sequence has rotated out.',
    };
  }

  // 7. Database session state check
  const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    return { valid: false, statusCode: 404, error: 'Attendance session not found.' };
  }

  const session = sessionResult.rows[0];
  if (session.ended_at) {
    return { valid: false, statusCode: 400, error: 'This attendance session has already ended.' };
  }

  // 8. Classroom enrollment check
  const enrollResult = await db.query(
    'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
    [session.classroom_id, studentId]
  );
  if (enrollResult.rows.length === 0) {
    return {
      valid: false,
      statusCode: 403,
      error: 'Forbidden: You are not enrolled in the classroom section for this session.',
    };
  }

  // 9. Duplicate attendance check
  const existingRecord = await db.query(
    'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
    [sessionId, studentId]
  );
  if (existingRecord.rows.length > 0) {
    return {
      valid: false,
      statusCode: 409,
      error: 'Conflict: Attendance has already been marked for this student in this session.',
    };
  }

  // 10. Parse scan_started_at and calculate Attendance Capture Latency (ACL).
  // The client-supplied start is untrusted: it may not be in the future, and
  // it can never make the capture latency smaller than the server-signed token
  // age (the QR frame cannot have been scanned before it was issued).
  let scanStartedDate = validatedAt;
  if (scanStartedAt !== undefined && scanStartedAt !== null) {
    scanStartedDate = new Date(scanStartedAt);
    if (Number.isNaN(scanStartedDate.getTime())) {
      return { valid: false, statusCode: 400, error: 'Invalid scan_started_at' };
    }
    if (scanStartedDate.getTime() > validatedAt.getTime() + 2000) {
      return { valid: false, statusCode: 400, error: 'Invalid scan_started_at' };
    }
  }

  const effectiveStartMs = Math.max(scanStartedDate.getTime(), tokenTimestamp);
  const effectiveStart = new Date(effectiveStartMs);
  const aclMs = Math.max(0, validatedAt.getTime() - effectiveStart.getTime());

  // 11. Insert record into attendance_records. The unique constraint closes the
  // check-then-insert race between two concurrent scan requests.
  let insertResult;
  try {
    insertResult = await db.query(
      `INSERT INTO attendance_records (session_id, student_id, scan_started_at, validated_at, status)
       VALUES ($1, $2, $3, $4, 'PRESENT')
       RETURNING *`,
      [sessionId, studentId, effectiveStart.toISOString(), validatedAt.toISOString()]
    );
  } catch (insertErr) {
    if (
      insertErr &&
      (insertErr.constraint === 'attendance_records_session_id_student_id_key' ||
        insertErr.code === '23505')
    ) {
      return {
        valid: false,
        statusCode: 409,
        error: 'Conflict: Attendance has already been marked for this student in this session.',
      };
    }
    throw insertErr;
  }

  return {
    valid: true,
    statusCode: 200,
    message: 'Attendance validated and marked PRESENT',
    record: insertResult.rows[0],
    acl_ms: aclMs,
  };
}

module.exports = {
  generate3QrSequence,
  validateAndMarkAttendance,
  TOKEN_TTL_SECONDS,
  MAX_TOKEN_AGE_MS,
  BATCH_REUSE_MS,
};
