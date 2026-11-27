import { evaluatePasswordPolicy } from '../lib/passwordUtils';

export interface BootstrapAdminAccount {
  email: string;
  roleCode: string;
  status: string;
  isDemoUser?: boolean;
}

interface EnsureBootstrapAdminOptions<T extends BootstrapAdminAccount> {
  users: Map<string, T>;
  email?: string;
  password?: string;
  allowedDomains: string[];
  allowDemoOnly: boolean;
  createUser: (email: string, password: string) => T;
  persistUser: (user: T) => Promise<void>;
}

/**
 * Bootstrap one institution administrator on an empty real-production database.
 * This is a one-time secret-backed path; it never changes an existing user's role.
 */
export async function ensureBootstrapAdmin<T extends BootstrapAdminAccount>({
  users,
  email,
  password,
  allowedDomains,
  allowDemoOnly,
  createUser,
  persistUser,
}: EnsureBootstrapAdminOptions<T>): Promise<void> {
  const activeAdmin = [...users.values()].some((user) =>
    !user.isDemoUser &&
    user.status === 'ACTIVE' &&
    (user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'COLLEGE_ADMIN'),
  );
  if (activeAdmin) return;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    if (allowDemoOnly) return;
    throw new Error('No active institutional administrator exists. Configure BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.endsWith('@demo.thapar.local')) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid non-demo email address.');
  }
  const domain = normalizedEmail.split('@').at(-1) || '';
  const normalizedAllowedDomains = allowedDomains.map((item) => item.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
  if (normalizedAllowedDomains.length > 0 && !normalizedAllowedDomains.includes(domain)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must use a domain listed in ALLOWED_EMAIL_DOMAINS.');
  }
  if (users.has(normalizedEmail)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL already belongs to a non-administrator account; refusing to change its role.');
  }
  const policy = evaluatePasswordPolicy(password);
  if (!policy.isValid) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD does not meet policy: ${policy.errors.join(', ')}.`);
  }

  const user = createUser(normalizedEmail, password);
  if (user.roleCode !== 'COLLEGE_ADMIN' || user.isDemoUser) {
    throw new Error('Bootstrap account factory must create a non-demo College Admin.');
  }
  await persistUser(user);
  users.set(normalizedEmail, user);
}
