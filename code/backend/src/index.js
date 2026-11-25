const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

/**
 * Fail fast on missing infrastructure secrets. In tests the harness injects
 * deterministic values, so this is skipped there.
 */
function validateEnvironment() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const required = ['DATABASE_URL', 'JWT_SECRET', 'QR_HMAC_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    // Never log the values themselves.
    console.error(`[ClassPulse Backend] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

validateEnvironment();

const db = require('./db');
const { getRedisClient, getRedisStatus } = require('./redis');
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const classroomsRoutes = require('./routes/classrooms');
const sessionsRoutes = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const pulsemetersRoutes = require('./routes/pulsemeters');
const liveActivitiesRoutes = require('./routes/liveActivities');
const wordCloudMutesRoutes = require('./routes/wordCloudMutes');
const quizzesRoutes = require('./routes/quizzes');
const doubtsRoutes = require('./routes/doubts');
const topicsRoutes = require('./routes/topics');
const searchRoutes = require('./routes/search');
const { createSocketServer } = require('./socket');
const { expireStaleSessions } = require('./services/sessionLifecycle');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Render/other reverse proxies terminate TLS and set X-Forwarded-For. Trust one
// hop so rate limiting sees the real client IP rather than the proxy IP.
app.set('trust proxy', 1);

// CORS allowlist. Requests without an Origin header (mobile apps, curl,
// server-to-server) are still allowed.
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || corsOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
}

// Setup Socket.io real-time WebSocket layer
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
createSocketServer(io);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '200kb' }));

// Initialize PostgreSQL database and Redis on startup. The server still starts
// if the database is unavailable so /health can report a degraded state.
db.initDb().catch((err) => {
  console.error('[ClassPulse DB] Startup initialization failed:', err.message);
});
getRedisClient();

expireStaleSessions().catch((err) => {
  console.error('[ClassPulse Session] Failed to expire stale sessions on startup:', err.message);
});

const staleSessionTimer = setInterval(() => {
  expireStaleSessions().catch((err) => {
    console.error('[ClassPulse Session] Failed to expire stale sessions:', err.message);
  });
}, 5 * 60 * 1000);

if (typeof staleSessionTimer.unref === 'function') {
  staleSessionTimer.unref();
}

// Mount API Routes
app.use('/auth', authRoutes);
app.use('/courses', coursesRoutes);
app.use('/classrooms', classroomsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/pulsemeters', pulsemetersRoutes);
app.use('/live-activities', liveActivitiesRoutes);
app.use('/word-cloud-mutes', wordCloudMutesRoutes);
app.use('/quizzes', quizzesRoutes);
app.use('/doubts', doubtsRoutes);
app.use('/courses', topicsRoutes);
app.use('/search', searchRoutes);

// Health Check Endpoint (Part 1 Acceptance Requirement)
app.get('/health', async (req, res) => {
  const dbReady = await db.healthCheck();
  const status = dbReady ? 'ok' : 'degraded';

  res.status(dbReady ? 200 : 503).json({
    status,
    service: 'classpulse-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    db: { status: dbReady ? 'ready' : 'unavailable' },
    redis: getRedisStatus(),
  });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ClassPulse API Server',
    health: '/health',
  });
});

// JSON 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Final error handler: log server-side, never expose stack traces to clients.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  console.error('[ClassPulse Backend] Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`[ClassPulse Backend] Server running on http://localhost:${PORT}`);
  console.log(`[ClassPulse Backend] Real-time WebSocket listening on port ${PORT}`);
  console.log(`[ClassPulse Backend] Health check available at http://localhost:${PORT}/health`);
});

function shutdown(signal) {
  console.log(`[ClassPulse Backend] Received ${signal}. Shutting down...`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  if (typeof forceExit.unref === 'function') forceExit.unref();

  server.close(() => {
    Promise.resolve(db.pool && db.pool.end ? db.pool.end() : null)
      .catch((err) => console.error('[ClassPulse DB] Error closing pool:', err.message))
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
