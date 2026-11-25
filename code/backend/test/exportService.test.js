const { test } = require('node:test');
const assert = require('node:assert/strict');

const { setHandler, reset, calls } = require('./helpers/mockDb');
const {
  escapeCsv,
  getAttendanceMatrixData,
  generateCsv,
} = require('../src/services/exportService');

test('escapeCsv quotes commas, quotes, and newlines', () => {
  assert.equal(escapeCsv('hello'), 'hello');
  assert.equal(escapeCsv('hello,world'), '"hello,world"');
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsv('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCsv(null), '');
  assert.equal(escapeCsv(undefined), '');
});

test('escapeCsv neutralizes spreadsheet formula injection', () => {
  assert.equal(escapeCsv('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsv('+1+1'), "'+1+1");
  assert.equal(escapeCsv('-1+1'), "'-1+1");
  assert.equal(escapeCsv('@cmd'), "'@cmd");
  assert.equal(escapeCsv('\t=1+1').startsWith("'"), true);
  assert.equal(escapeCsv('\r=1+1').startsWith("\"'"), true);
});

test('escapeCsv neutralizes formulas before applying CSV quoting', () => {
  assert.equal(escapeCsv('=1,2'), '"\'=1,2"');
  assert.equal(escapeCsv('@a,b'), '"\'@a,b"');
});

test('export matrix excludes sessions held before a student enrolled', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: 'classroom-1',
            section_name: '3C75',
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            teacher_name: 'Prof. Teacher',
          },
        ],
      };
    }
    if (/from sessions\b/i.test(sql)) {
      return {
        rows: [
          { id: 'session-1', started_at: '2026-11-03T10:43:42.760Z', ended_at: '2026-11-03T10:47:01.696Z' },
          { id: 'session-2', started_at: '2026-11-03T10:47:22.404Z', ended_at: '2026-11-03T10:47:29.060Z' },
        ],
      };
    }
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            student_id: 'student-1',
            full_name: 'Late Joiner',
            email: 'late@example.com',
            joined_at: '2026-11-03T10:49:12.331Z',
          },
        ],
      };
    }
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const data = await getAttendanceMatrixData('classroom-1');

  assert.equal(data.rows.length, 1);
  const row = data.rows[0];
  assert.deepEqual(row.sessionStatuses, ['N/A', 'N/A']);
  assert.equal(row.attendedCount, 0);
  assert.equal(row.totalSessions, 0);
  assert.equal(row.percentage, null);
  assert.equal(row.status, 'No sessions since joining');

  const sessionsQuery = calls.find((call) => /from sessions\b/i.test(call.sql));
  assert.ok(sessionsQuery);
  assert.match(sessionsQuery.sql, /ended_at IS NOT NULL/i);

  const recordsQuery = calls.find((call) => /from attendance_records ar/i.test(call.sql));
  assert.ok(recordsQuery);
  assert.match(recordsQuery.sql, /EXTRACT\(EPOCH/i);
  reset();
});

test('export omits the session currently in progress from the matrix and denominators', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [
          {
            id: 'classroom-1',
            section_name: '3C75',
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            teacher_name: 'Prof. Teacher',
          },
        ],
      };
    }
    if (/from sessions\b/i.test(sql)) {
      // Mimic the DB filter so a missing WHERE clause would leak the live row.
      const onlyCompleted = /ended_at IS NOT NULL/i.test(sql);
      const rows = [
        { id: 'session-1', started_at: '2026-11-03T10:00:00.000Z', ended_at: '2026-11-03T10:05:00.000Z' },
        { id: 'session-live', started_at: '2026-11-03T10:10:00.000Z', ended_at: null },
      ];
      return { rows: onlyCompleted ? rows.filter((r) => r.ended_at != null) : rows };
    }
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            student_id: 'student-1',
            full_name: 'Student One',
            email: 'student@example.com',
            joined_at: '2026-11-03T09:00:00.000Z',
          },
        ],
      };
    }
    if (/from attendance_records ar/i.test(sql)) {
      return {
        rows: [
          {
            session_id: 'session-1',
            student_id: 'student-1',
            status: 'PRESENT',
            validated_at: '2026-11-03T10:00:03.000Z',
            acl_ms: 3000,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const data = await getAttendanceMatrixData('classroom-1');

  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].id, 'session-1');
  assert.equal(data.rows[0].sessionStatuses.length, 1);
  assert.deepEqual(data.rows[0].sessionStatuses, ['P']);
  assert.equal(data.rows[0].totalSessions, 1);

  const sessionsQuery = calls.find((call) => /from sessions\b/i.test(call.sql));
  assert.ok(sessionsQuery);
  assert.match(sessionsQuery.sql, /ended_at IS NOT NULL/i);

  const csv = await generateCsv('classroom-1');
  assert.match(csv, /Excludes the session currently in progress/);
  reset();
});
