const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  escapeHtml,
  sendLowAttendanceWarningEmail,
} = require('../src/services/emailService');

const warning = {
  to: 'student@example.com',
  studentName: 'Test Student',
  courseCode: 'UCS503P',
  courseName: 'Software Engineering Lab',
  sectionName: '3CSE1',
  teacherName: 'Prof. Teacher',
  attendancePct: 60,
  attendedCount: 6,
  totalCount: 10,
};

function snapshotEnv(keys) {
  const saved = {};
  for (const key of keys) saved[key] = process.env[key];
  return saved;
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test('escapeHtml neutralizes HTML metacharacters', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
  );
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(75), '75');
});

test('a failing Brevo request falls back to Resend', async () => {
  const saved = snapshotEnv([
    'BREVO_API_KEY',
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ]);
  const originalFetch = global.fetch;
  const calls = [];

  process.env.BREVO_API_KEY = 'brevo-test-key';
  process.env.RESEND_API_KEY = 'resend-test-key';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  global.fetch = async (url) => {
    calls.push(url);
    if (String(url).includes('brevo')) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ message: 'Brevo unavailable' }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-message-id' }),
    };
  };

  try {
    const result = await sendLowAttendanceWarningEmail(warning);
    assert.equal(result.messageId, 'resend-message-id');
    assert.equal(calls.length, 2);
    assert.match(calls[0], /brevo/);
    assert.match(calls[1], /resend/);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('all configured providers failing produces a combined error', async () => {
  const saved = snapshotEnv([
    'BREVO_API_KEY',
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ]);
  const originalFetch = global.fetch;

  process.env.BREVO_API_KEY = 'brevo-test-key';
  process.env.RESEND_API_KEY = 'resend-test-key';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'provider down' }),
  });

  try {
    await assert.rejects(
      () => sendLowAttendanceWarningEmail(warning),
      /All configured email providers failed: .*Brevo.*Resend/
    );
  } finally {
    global.fetch = originalFetch;
    restoreEnv(saved);
  }
});
