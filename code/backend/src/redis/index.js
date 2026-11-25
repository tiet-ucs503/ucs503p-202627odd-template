const Redis = require('ioredis');
require('dotenv').config();

// Redis is used only as a short-lived (15s) cache for rotating QR tokens.
// It must never be able to break attendance, so every command is wrapped with
// a timeout + automatic in-memory fallback. If Upstash is unreachable, expired,
// deleted or over quota, the API keeps working on a single instance instead of
// returning 500s ("Failed to start attendance session").
const CONNECT_TIMEOUT_MS = 3000;
const COMMAND_TIMEOUT_MS = 2000;

let client = null;
let connectPromise = null;
let memoryStore = null;
let degraded = false;
let degradedReason = null;

// Local mirror / fallback if Redis is unreachable. Keys expire just like Redis EX.
function createInMemoryFallback() {
  const store = new Map();
  const timeouts = new Map();

  return {
    async set(key, value, mode, duration) {
      store.set(key, value);
      if (timeouts.has(key)) clearTimeout(timeouts.get(key));
      if (mode === 'EX' && duration) {
        const timeout = setTimeout(() => {
          store.delete(key);
          timeouts.delete(key);
        }, duration * 1000);
        if (typeof timeout.unref === 'function') timeout.unref();
        timeouts.set(key, timeout);
      }
      return 'OK';
    },
    async get(key) {
      return store.get(key) || null;
    },
    async del(key) {
      if (timeouts.has(key)) clearTimeout(timeouts.get(key));
      timeouts.delete(key);
      return store.delete(key) ? 1 : 0;
    },
  };
}

const memory = () => {
  if (!memoryStore) memoryStore = createInMemoryFallback();
  return memoryStore;
};

function degrade(reason) {
  if (degraded) return;
  degraded = true;
  degradedReason = reason;
  console.warn(
    `[ClassPulse Redis] Unavailable (${reason}). Falling back to in-memory cache. ` +
      'Attendance keeps working on this instance, but the REDIS_URL must be fixed ' +
      '(recreate the Upstash database if it expired) and the backend restarted.'
  );
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function connect() {
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      degrade('REDIS_URL not set');
      return;
    }

    let lastConnectionError = null;

    try {
      client = new Redis(redisUrl, {
        connectTimeout: CONNECT_TIMEOUT_MS,
        // Lazy connect so we can await a real handshake before serving traffic.
        lazyConnect: true,
        // Fail fast instead of queueing: a dead Redis must not stall requests.
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        retryStrategy(times) {
          return Math.min(times * 500, 5000);
        },
      });

      client.on('ready', () => {
        console.log('[ClassPulse Redis] Successfully connected to Upstash Redis');
      });

      client.on('error', (err) => {
        // Transient reconnect notices are expected; a real outage is detected
        // on the next command, which fails fast and degrades to memory.
        lastConnectionError = err.message;
        console.warn('[ClassPulse Redis] Redis connection warning:', err.message);
      });

      await withTimeout(client.connect(), CONNECT_TIMEOUT_MS, 'Redis connect');
      await withTimeout(client.ping(), COMMAND_TIMEOUT_MS, 'Redis PING');
      console.log('[ClassPulse Redis] Handshake verified (PING ok)');
    } catch (err) {
      degrade(lastConnectionError || err.message || String(err));
      if (client) {
        try {
          client.disconnect();
        } catch (_) {
          // ignore
        }
        client = null;
      }
    }
  })();

  return connectPromise;
}

const canUseRedis = () => !degraded && client && client.status === 'ready';

/**
 * Returns a Redis-like client ({ set, get, del }). Never throws on connection
 * or command failure — it transparently degrades to the in-memory store.
 */
function getRedisClient() {
  // Kick off the connection in the background (same behavior as before).
  connect();

  return {
    async set(key, value, mode, duration) {
      // Always mirror locally so an outage mid-session does not invalidate
      // token batches that were already handed to the teacher's projector.
      await memory().set(key, value, mode, duration);

      await connect();
      if (!canUseRedis()) return 'OK';

      try {
        return await withTimeout(client.set(key, value, mode, duration), COMMAND_TIMEOUT_MS, 'Redis SET');
      } catch (err) {
        degrade(err.message || String(err));
        return 'OK';
      }
    },

    async get(key) {
      await connect();

      const local = await memory().get(key);
      if (local !== null) return local;

      if (!canUseRedis()) return null;

      try {
        return await withTimeout(client.get(key), COMMAND_TIMEOUT_MS, 'Redis GET');
      } catch (err) {
        degrade(err.message || String(err));
        return null;
      }
    },

    async del(key) {
      await connect();
      await memory().del(key);

      if (!canUseRedis()) return 1;

      try {
        return await withTimeout(client.del(key), COMMAND_TIMEOUT_MS, 'Redis DEL');
      } catch (err) {
        degrade(err.message || String(err));
        return 1;
      }
    },
  };
}

/**
 * Diagnostics for /health — exposes whether the shared cache is healthy
 * so a silent degradation is easy to spot in production.
 */
function getRedisStatus() {
  if (degraded) {
    return { status: 'degraded', backend: 'memory', reason: degradedReason };
  }
  if (!connectPromise) {
    return { status: 'idle', backend: 'unknown' };
  }
  return { status: client && client.status === 'ready' ? 'connected' : 'connecting', backend: 'redis' };
}

module.exports = {
  getRedisClient,
  getRedisStatus,
};
