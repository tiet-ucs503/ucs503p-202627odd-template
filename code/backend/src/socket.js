const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const { canAccessClassroom, isClassroomTeacher } = require('./utils/access');

function sendAck(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

async function getSession(sessionId) {
  const result = await db.query(
    `SELECT s.id, s.classroom_id, c.teacher_id
     FROM sessions s
     JOIN classrooms c ON s.classroom_id = c.id
     WHERE s.id = $1`,
    [sessionId]
  );
  return result.rows[0] || null;
}

async function getActivity(activityId) {
  const result = await db.query(
    'SELECT id, classroom_id FROM live_activities WHERE id = $1',
    [activityId]
  );
  return result.rows[0] || null;
}

/**
 * Attach authenticated, authorized Socket.io handlers to an existing server.
 *
 * Every room join is authorized against the database before `socket.join` is
 * called. The client-supplied JWT is the only source of user identity.
 */
function createSocketServer(io) {
  io.on('connection', (socket) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      socket.emit('auth:error', { error: 'Authentication required' });
      socket.disconnect(true);
      return;
    }

    try {
      socket.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      socket.emit('auth:error', { error: 'Invalid or expired token' });
      socket.disconnect(true);
      return;
    }

    console.log(`[ClassPulse Socket] Client connected: ${socket.id}`);

    // Attendance session rooms
    socket.on('join_session', async (sessionId, ack) => {
      try {
        if (!sessionId) {
          return sendAck(ack, { ok: false, error: 'sessionId is required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
          return sendAck(ack, { ok: false, error: 'Session not found' });
        }

        // The session room broadcasts every attendee's name and email. Only the
        // owning teacher may join it; students never need this room.
        const allowed = socket.user.role === 'teacher'
          && await isClassroomTeacher(socket.user.id, session.classroom_id);
        if (!allowed) {
          return sendAck(ack, { ok: false, error: 'Forbidden: Only the owning teacher can join this session' });
        }

        socket.join(`session_${sessionId}`);
        sendAck(ack, { ok: true });
      } catch (err) {
        console.error('[ClassPulse Socket] join_session error:', err);
        sendAck(ack, { ok: false, error: 'Failed to join session' });
      }
    });

    socket.on('leave_session', async (sessionId, ack) => {
      if (sessionId) {
        socket.leave(`session_${sessionId}`);
      }
      sendAck(ack, { ok: true });
    });

    // Classroom broadcast channels
    socket.on('join_classroom', async (classroomId, ack) => {
      try {
        if (!classroomId) {
          return sendAck(ack, { ok: false, error: 'classroomId is required' });
        }

        const allowed = await canAccessClassroom(socket.user, classroomId);
        if (!allowed) {
          return sendAck(ack, { ok: false, error: 'Forbidden: You do not have access to this classroom' });
        }

        socket.join(`classroom_${classroomId}`);
        sendAck(ack, { ok: true });
      } catch (err) {
        console.error('[ClassPulse Socket] join_classroom error:', err);
        sendAck(ack, { ok: false, error: 'Failed to join classroom' });
      }
    });

    socket.on('leave_classroom', async (classroomId, ack) => {
      if (classroomId) {
        socket.leave(`classroom_${classroomId}`);
      }
      sendAck(ack, { ok: true });
    });

    // Live Activity rooms (PulseMeter / Quizzing)
    socket.on('join_activity', async (activityId, ack) => {
      try {
        if (!activityId) {
          return sendAck(ack, { ok: false, error: 'activityId is required' });
        }

        const activity = await getActivity(activityId);
        if (!activity) {
          return sendAck(ack, { ok: false, error: 'Activity not found' });
        }

        const allowed = await canAccessClassroom(socket.user, activity.classroom_id);
        if (!allowed) {
          return sendAck(ack, { ok: false, error: 'Forbidden: You do not have access to this activity' });
        }

        socket.join(`activity_${activityId}`);
        sendAck(ack, { ok: true });
      } catch (err) {
        console.error('[ClassPulse Socket] join_activity error:', err);
        sendAck(ack, { ok: false, error: 'Failed to join activity' });
      }
    });

    socket.on('join_activity_teacher', async (activityId, ack) => {
      try {
        if (!activityId) {
          return sendAck(ack, { ok: false, error: 'activityId is required' });
        }

        const activity = await getActivity(activityId);
        if (!activity) {
          return sendAck(ack, { ok: false, error: 'Activity not found' });
        }

        const isTeacher = socket.user.role === 'teacher'
          && await isClassroomTeacher(socket.user.id, activity.classroom_id);
        if (!isTeacher) {
          return sendAck(ack, { ok: false, error: 'Forbidden: Only the owning teacher can join' });
        }

        socket.join(`activity_${activityId}_teacher`);
        sendAck(ack, { ok: true });
      } catch (err) {
        console.error('[ClassPulse Socket] join_activity_teacher error:', err);
        sendAck(ack, { ok: false, error: 'Failed to join activity' });
      }
    });

    socket.on('leave_activity', async (activityId, ack) => {
      if (activityId) {
        socket.leave(`activity_${activityId}`);
        socket.leave(`activity_${activityId}_teacher`);
      }
      sendAck(ack, { ok: true });
    });

    socket.on('disconnect', () => {
      console.log(`[ClassPulse Socket] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = {
  createSocketServer,
  attachSocketHandlers: createSocketServer,
};
