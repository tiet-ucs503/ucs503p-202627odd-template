import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { connectDb } from '../src/server/db';

test('database migrations are recorded and skipped on subsequent startup', async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intellischedule-migrations-'));
  const url = `pglite:${databaseDir}`;
  let db = await connectDb(url);
  try {
    const firstRun = await db.query<{ count: string }>('select count(*)::text as count from intellischedule.application_migrations');
    const expectedMigrations = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter((file) => file.endsWith('.sql')).length;
    assert.strictEqual(Number(firstRun[0]?.count), expectedMigrations);
    await db.close();

    db = await connectDb(url);
    const secondRun = await db.query<{ count: string }>('select count(*)::text as count from intellischedule.application_migrations');
    assert.strictEqual(Number(secondRun[0]?.count), expectedMigrations);
  } finally {
    await db.close();
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
});
