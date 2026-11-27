import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureBootstrapAdmin, type BootstrapAdminAccount } from '../src/server/bootstrapAdmin';

interface TestUser extends BootstrapAdminAccount {
  id: string;
  name: string;
  password: string;
  isDemoUser: boolean;
}

const createUser = (email: string, password: string): TestUser => ({
  id: 'initial-admin',
  email,
  name: 'Initial Admin',
  password,
  roleCode: 'COLLEGE_ADMIN',
  status: 'ACTIVE',
  isDemoUser: false,
});

const options = (users: Map<string, TestUser>) => ({
  users,
  email: 'dean@thapar.edu',
  password: 'Bootstrap-Admin-2026!',
  allowedDomains: ['thapar.edu'],
  allowDemoOnly: false,
  createUser,
  persistUser: async () => {},
});

test('production bootstraps the first active non-demo administrator durably', async () => {
  const users = new Map<string, TestUser>();
  let persisted: TestUser | undefined;
  await ensureBootstrapAdmin({
    ...options(users),
    persistUser: async (user) => { persisted = user; },
  });
  assert.equal(persisted?.email, 'dean@thapar.edu');
  assert.equal(users.get('dean@thapar.edu'), persisted);
  assert.equal(persisted?.roleCode, 'COLLEGE_ADMIN');
  assert.equal(persisted?.isDemoUser, false);
});

test('bootstrap is idempotent when an active institutional administrator exists', async () => {
  const users = new Map<string, TestUser>([['dean@thapar.edu', createUser('dean@thapar.edu', 'existing')]]);
  await ensureBootstrapAdmin({ ...options(users), email: undefined, password: undefined });
  assert.equal(users.size, 1);
});

test('presentation-only deployment may start with demo administrators and no bootstrap secret', async () => {
  const users = new Map<string, TestUser>([['admin.demo@demo.thapar.local', {
    ...createUser('admin.demo@demo.thapar.local', 'demo'), isDemoUser: true,
  }]]);
  await ensureBootstrapAdmin({ ...options(users), email: undefined, password: undefined, allowDemoOnly: true });
  assert.equal(users.size, 1);
});

test('production refuses an empty admin setup without bootstrap credentials', async () => {
  await assert.rejects(ensureBootstrapAdmin({ ...options(new Map()), email: undefined, password: undefined }), /BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD/);
});

test('bootstrap rejects invalid domains, demo identities, weak passwords, and role takeover', async () => {
  await assert.rejects(ensureBootstrapAdmin({ ...options(new Map()), email: 'admin@gmail.com' }), /ALLOWED_EMAIL_DOMAINS/);
  await assert.rejects(ensureBootstrapAdmin({ ...options(new Map()), email: 'admin@demo.thapar.local' }), /non-demo email/);
  await assert.rejects(ensureBootstrapAdmin({ ...options(new Map()), password: 'weak' }), /does not meet policy/);
  const existingStudent = new Map<string, TestUser>([['dean@thapar.edu', {
    ...createUser('dean@thapar.edu', 'existing'), roleCode: 'STUDENT',
  }]]);
  await assert.rejects(ensureBootstrapAdmin({ ...options(existingStudent) }), /refusing to change its role/);
});

test('failed database persistence does not expose the bootstrap admin in memory', async () => {
  const users = new Map<string, TestUser>();
  await assert.rejects(ensureBootstrapAdmin({
    ...options(users),
    persistUser: async () => { throw new Error('database unavailable'); },
  }), /database unavailable/);
  assert.equal(users.size, 0);
});
