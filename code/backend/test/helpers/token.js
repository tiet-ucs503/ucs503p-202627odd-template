require('./setup');

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/middleware/auth');

const users = {
  teacher: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'teacher@example.com',
    full_name: 'Test Teacher',
    role: 'teacher',
  },
  student: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'student@example.com',
    full_name: 'Test Student',
    role: 'student',
  },
  otherTeacher: {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'other.teacher@example.com',
    full_name: 'Other Teacher',
    role: 'teacher',
  },
  otherStudent: {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'other.student@example.com',
    full_name: 'Other Student',
    role: 'student',
  },
};

function makeToken(overrides = {}) {
  const claims = { ...users.student, ...overrides };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { users, makeToken };
