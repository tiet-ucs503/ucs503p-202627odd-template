require('./setup');
require('./mockDb');
require('./mockRedis');

const express = require('express');

/**
 * Builds an Express app with the real routers and an in-memory fake DB/Redis.
 * Returns the app plus a lightweight Socket.io double that records emits.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  const io = {
    events: [],
    to(room) {
      return {
        emit(event, payload) {
          io.events.push({ room, event, payload });
        },
      };
    },
  };
  app.set('io', io);

  app.use('/auth', require('../../src/routes/auth'));
  app.use('/courses', require('../../src/routes/courses'));
  app.use('/classrooms', require('../../src/routes/classrooms'));
  app.use('/sessions', require('../../src/routes/sessions'));
  app.use('/attendance', require('../../src/routes/attendance'));
  app.use('/pulsemeters', require('../../src/routes/pulsemeters'));
  app.use('/live-activities', require('../../src/routes/liveActivities'));
  app.use('/word-cloud-mutes', require('../../src/routes/wordCloudMutes'));
  app.use('/quizzes', require('../../src/routes/quizzes'));
  app.use('/doubts', require('../../src/routes/doubts'));
  app.use('/courses', require('../../src/routes/topics'));
  app.use('/search', require('../../src/routes/search'));

  // Keep Express' HTML stack trace out of test responses.
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    res.status(500).json({ error: err.message || 'Internal test error' });
  });

  return { app, io };
}

module.exports = { buildApp };
