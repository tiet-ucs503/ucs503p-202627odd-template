const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const useSsl = Boolean(connectionString && connectionString.includes('sslmode=')) || process.env.NODE_ENV === 'production';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const pool = new Pool({
  connectionString,
  // TLS certificates are verified by default. `DB_SSL_REJECT_UNAUTHORIZED=false`
  // is an explicit opt-out for environments with self-signed certificates.
  ssl: useSsl ? { rejectUnauthorized } : false,
});

pool.on('error', (err) => {
  console.error('[ClassPulse DB] Unexpected error on idle PostgreSQL client:', err.message);
});

let ready = false;

async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    ready = true;
    console.log('[ClassPulse DB] PostgreSQL database schema initialized successfully on Neon.');
    return true;
  } catch (err) {
    ready = false;
    console.error('[ClassPulse DB] Error initializing database schema:', err.message);
    return false;
  }
}

/**
 * Lightweight readiness probe used by /health. Never throws.
 */
async function healthCheck(timeoutMs = 3000) {
  let timer;

  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database health check timed out')), timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
    return true;
  } catch (err) {
    console.error('[ClassPulse DB] Health check failed:', err.message);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isReady() {
  return ready;
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb,
  healthCheck,
  isReady,
};
