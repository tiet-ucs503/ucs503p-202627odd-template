import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSeedDemoData } from '../src/server/supabaseStore';

test('production starts without sample academic data unless explicitly enabled', () => {
  assert.equal(shouldSeedDemoData({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), false);
  assert.equal(shouldSeedDemoData({ NODE_ENV: 'production', SEED_DEMO_DATA: 'false' } as NodeJS.ProcessEnv), false);
  assert.equal(shouldSeedDemoData({ NODE_ENV: 'production', SEED_DEMO_DATA: 'true' } as NodeJS.ProcessEnv), true);
});

test('non-production environments keep the sample dataset by default', () => {
  assert.equal(shouldSeedDemoData({ NODE_ENV: 'test' } as NodeJS.ProcessEnv), true);
  assert.equal(shouldSeedDemoData({ NODE_ENV: 'development', SEED_DEMO_DATA: 'false' } as NodeJS.ProcessEnv), false);
});
