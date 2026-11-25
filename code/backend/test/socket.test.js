const http = require('http');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

require('./helpers/setup');
const { setHandler, reset } = require('./helpers/mockDb');
const { users, makeToken } = require('./helpers/token');
const { createSocketServer } = require('../src/socket');

const SESSION = '31313131-3131-4131-8131-313131313131';
const CLASSROOM = '32323232-3232-4232-8232-323232323232';
const ACTIVITY = '33333333-3333-4333-8333-333333333333';

let httpServer;
let ioServer;
let base;

before(async () => {
  httpServer = http.createServer();
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  createSocketServer(ioServer);

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  await new Promise((resolve) => ioServer.close(resolve));
});

beforeEach(() => reset());

function connect(auth) {
  return Client(base, {
    auth,
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
}

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    if (client.connected) return resolve();
    const timer = setTimeout(() => reject(new Error('timed out waiting for connect')), 3000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    client.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emitWithAck(client, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event} ack`)), 3000);
    client.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

test('unauthenticated socket connections are rejected', async () => {
  const client = connect({});

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for auth:error')), 3000);
    client.on('auth:error', (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      resolve({ error: err.message });
    });
  });

  assert.ok(result && result.error);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(client.connected, false);
  client.close();
});

test('a socket with an invalid token is rejected', async () => {
  const client = connect({ token: 'not-a-valid-jwt' });

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for auth:error')), 3000);
    client.on('auth:error', (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      resolve({ error: err.message });
    });
  });

  assert.ok(result && result.error);
  client.close();
});

test('a student cannot join a session room for a classroom they are not in', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return { rows: [{ id: SESSION, classroom_id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/select 1 from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const client = connect({ token: makeToken(users.student) });
  await waitForConnect(client);

  const ack = await emitWithAck(client, 'join_session', SESSION);
  assert.deepEqual(ack, { ok: false, error: 'Forbidden: Only the owning teacher can join this session' });

  client.close();
});

test('the owning teacher can join a session room', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return { rows: [{ id: SESSION, classroom_id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/from classrooms where id/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });

  const client = connect({ token: makeToken(users.teacher) });
  await waitForConnect(client);

  const ack = await emitWithAck(client, 'join_session', SESSION);
  assert.deepEqual(ack, { ok: true });

  client.close();
});

test('an enrolled student cannot join a session room because it broadcasts attendance PII', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return { rows: [{ id: SESSION, classroom_id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/select 1 from enrollments/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });

  const client = connect({ token: makeToken(users.student) });
  await waitForConnect(client);

  const ack = await emitWithAck(client, 'join_session', SESSION);
  assert.deepEqual(ack, { ok: false, error: 'Forbidden: Only the owning teacher can join this session' });

  client.close();
});

test('only the owning teacher can join the teacher activity room', async () => {
  setHandler(async (sql) => {
    if (/from live_activities/i.test(sql)) {
      return { rows: [{ id: ACTIVITY, classroom_id: CLASSROOM }] };
    }
    if (/from classrooms where id/i.test(sql)) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });

  const student = connect({ token: makeToken(users.student) });
  await waitForConnect(student);
  const studentAck = await emitWithAck(student, 'join_activity_teacher', ACTIVITY);
  assert.equal(studentAck.ok, false);
  student.close();

  const teacher = connect({ token: makeToken(users.teacher) });
  await waitForConnect(teacher);
  const teacherAck = await emitWithAck(teacher, 'join_activity_teacher', ACTIVITY);
  assert.equal(teacherAck.ok, true);
  teacher.close();
});

test('a student cannot join an activity from another classroom', async () => {
  setHandler(async (sql) => {
    if (/from live_activities/i.test(sql)) {
      return { rows: [{ id: ACTIVITY, classroom_id: CLASSROOM }] };
    }
    if (/select 1 from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const client = connect({ token: makeToken(users.student) });
  await waitForConnect(client);

  const ack = await emitWithAck(client, 'join_activity', ACTIVITY);
  assert.equal(ack.ok, false);

  client.close();
});
