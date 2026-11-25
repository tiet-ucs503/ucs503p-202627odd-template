const db = require('../db');

/**
 * End attendance sessions that were left open (e.g. the teacher closed the
 * browser without pressing "End"). Any pending live activity in those
 * classrooms is linked to the session and unblocked so analytics can resolve.
 *
 * Returns { expired: <number of sessions ended> }.
 */
async function expireStaleSessions({ maxAgeHours = Number(process.env.SESSION_MAX_HOURS || 4) } = {}) {
  const numericMaxAge = Number(maxAgeHours);
  const hours = Number.isFinite(numericMaxAge) && numericMaxAge > 0 ? numericMaxAge : 4;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const staleRes = await client.query(
      `SELECT id, classroom_id
       FROM sessions
       WHERE ended_at IS NULL
         AND started_at < now() - ($1::text || ' hours')::interval
       FOR UPDATE`,
      [hours]
    );

    const sessions = staleRes.rows;

    if (sessions.length === 0) {
      await client.query('COMMIT');
      return { expired: 0 };
    }

    const sessionIds = sessions.map((session) => session.id);

    await client.query(
      `UPDATE sessions
       SET ended_at = now()
       WHERE id = ANY($1::uuid[])`,
      [sessionIds]
    );

    // Map each classroom to its most recent stale session, then resolve any
    // activities that were waiting for attendance.
    await client.query(
      `UPDATE live_activities la
       SET attendance_session_id = s.id, attendance_pending = FALSE
       FROM (
         SELECT DISTINCT ON (classroom_id) id, classroom_id
         FROM sessions
         WHERE id = ANY($1::uuid[])
         ORDER BY classroom_id, started_at DESC
       ) s
       WHERE la.classroom_id = s.classroom_id
         AND la.attendance_pending = TRUE`,
      [sessionIds]
    );

    await client.query('COMMIT');
    return { expired: sessions.length };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback failures; the original error is more useful.
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { expireStaleSessions };
