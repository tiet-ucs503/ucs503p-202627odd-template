import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { persistentStore, persistentDatabase, StoredSession } from './src/server/persistentStore';
import { ensureBootstrapAdmin } from './src/server/bootstrapAdmin';
import { isTestTokenAllowed } from './src/server/testMode';
export { isTestTokenAllowed };
import {
  hashPasswordBcrypt,
  hashPasswordBcryptSync,
  hashPasswordScrypt,
  verifyPassword,
  hashPasswordLegacy,
  evaluatePasswordPolicy,
  BCRYPT_SALT_ROUNDS,
  MAX_PASSWORD_LENGTH,
} from './src/lib/passwordUtils';
import { executeOptimizationEngine, compileSchedulingProblem } from './src/lib/optimizationEngine';
import {
  INITIAL_ACADEMIC_YEAR,
  INITIAL_ALLOCATIONS,
  FACULTY_MEMBERS,
  ROOMS,
  SECTIONS,
  COURSES,
  INITIAL_CONSTRAINTS,
} from './src/lib/initialData';
import { supabaseStore } from './src/server/supabaseStore';
import { timetableJobManager } from './src/server/jobManager';
import { sendEmail, checkMailerConfiguration, hasMailerConfiguration } from './src/server/mailer';
import { connectDb, type Db } from './src/server/db';
import type { DayOfWeek } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
checkMailerConfiguration();
const port = process.env.PORT || 3000;

const SERVER_INSTANCE_ID = crypto.randomUUID();
const ACADEMIC_STATE_KEY = 'legacy_academic_runtime';
let pgListenerClient: any = null;
let pgListenerStopped = false;
let academicDb: Db | null = null;
let academicStateVersion = 0;
let academicStateJson = '';
let academicWriteQueue: Promise<void> = Promise.resolve();

class AcademicStateConflictError extends Error {
  constructor() {
    super('Academic data changed in another server process. Reload and retry your change.');
  }
}

async function loadAcademicState() {
  if (!academicDb) return;
  const rows = await academicDb.query<{ data: Record<string, any>; version: number }>(
    'select data, version from intellischedule.app_state where key = $1',
    [ACADEMIC_STATE_KEY],
  );
  if (rows[0]) {
    supabaseStore.restorePersistedState(rows[0].data);
    academicStateVersion = rows[0].version;
    academicStateJson = JSON.stringify(rows[0].data);
    return;
  }

  const initial = supabaseStore.exportPersistedState();
  const inserted = await academicDb.query<{ version: number }>(
    'insert into intellischedule.app_state (key, data) values ($1, $2::jsonb) on conflict (key) do nothing returning version',
    [ACADEMIC_STATE_KEY, JSON.stringify(initial)],
  );
  if (inserted[0]) {
    academicStateVersion = inserted[0].version;
    academicStateJson = JSON.stringify(initial);
    console.info('[ACADEMIC STORE] Initial timetable dataset persisted to Supabase PostgreSQL.');
  } else {
    await loadAcademicState();
  }
}

async function persistAcademicState() {
  if (!academicDb) return;
  const snapshot = supabaseStore.exportPersistedState();
  const json = JSON.stringify(snapshot);
  if (json === academicStateJson) return;
  const rows = await academicDb.query<{ version: number }>(
    'update intellischedule.app_state set data = $2::jsonb, version = version + 1, updated_at = now() where key = $1 and version = $3 returning version',
    [ACADEMIC_STATE_KEY, json, academicStateVersion],
  );
  if (!rows[0]) {
    await loadAcademicState();
    throw new AcademicStateConflictError();
  }
  academicStateVersion = rows[0].version;
  academicStateJson = json;
  try {
    await academicDb.query("select pg_notify('intellischedule_events', $1)", [
      JSON.stringify({ instanceId: SERVER_INSTANCE_ID, version: academicStateVersion, at: new Date().toISOString() }),
    ]);
  } catch {
    // Non-fatal if embedded pglite or pooler restricts NOTIFY
  }
}


async function startPostgresEventListener(attempt = 0): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (pgListenerStopped || !dbUrl || dbUrl.startsWith('pglite:')) return;
  try {
    const { default: pg } = await import('pg');
    const parsed = new URL(dbUrl);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    parsed.searchParams.delete('sslmode');
    const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
    const client = new pg.Client({
      connectionString: parsed.toString(),
      ssl: isLocal ? false : ca ? { ca } : { rejectUnauthorized: false },
    });
    pgListenerClient = client;
    client.on('notification', async (msg: { payload?: string }) => {
      try {
        const parsedMsg = msg.payload ? JSON.parse(msg.payload) : {};
        if (parsedMsg.instanceId === SERVER_INSTANCE_ID) return;
        await loadAcademicState();
        broadcastRealtimeEvent('/api/events/pg-sync', typeof parsedMsg.sectionId === 'string' ? parsedMsg.sectionId : undefined);
      } catch (err) {
        console.warn('[PG LISTEN] Failed to process cross-instance notification:', err instanceof Error ? err.message : err);
      }
    });
    client.on('error', () => {
      if (pgListenerStopped) return;
      const delay = Math.min(30_000, 1000 * Math.pow(2, attempt));
      setTimeout(() => void startPostgresEventListener(attempt + 1), delay).unref?.();
    });
    await client.connect();
    await client.query('LISTEN intellischedule_events');
    console.info('[PG LISTEN] Connected dedicated cross-instance event listener.');
  } catch {
    if (pgListenerStopped) return;
    const delay = Math.min(30_000, 1000 * Math.pow(2, attempt));
    setTimeout(() => void startPostgresEventListener(attempt + 1), delay).unref?.();
  }
}

async function initializeAcademicPersistence() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required for durable timetable storage.');
    return;
  }
  // Production auth and timetable persistence share one bounded PostgreSQL pool.
  academicDb = persistentDatabase || await connectDb(process.env.DATABASE_URL);
  await loadAcademicState();
  void startPostgresEventListener();
  await loadPersistedUsers();
  if (process.env.NODE_ENV === 'production') {
    await ensureBootstrapAdmin({
      users: usersDatabase,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS || '').split(','),
      allowDemoOnly: process.env.PUBLIC_DEMO_ENABLED === 'true' && process.env.ALLOW_DEMO_IN_PRODUCTION === 'true',
      createUser: (email, password): StoredUser => ({
        id: crypto.randomUUID(),
        name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || email.split('@')[0],
        email,
        passwordHash: hashPasswordBcryptSync(password),
        roleId: 'role-college_admin',
        roleCode: 'COLLEGE_ADMIN',
        roleName: 'College Admin / Dean',
        institutionId: 'inst-thapar',
        institutionName: 'Thapar Institute of Engineering and Technology',
        department: 'Office of the Dean',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        authorizedWorkspaces: ['Admin', 'Coordinator'],
        isDemoUser: false,
        emailVerified: true,
        profile: {},
      }),
      persistUser: persistNewUserRecord,
    });
  }
}

// Initialize Server-side Supabase Clients
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const supabaseAnonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export const supabaseAnon: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

if (supabaseAdmin) {
  console.info('[SUPABASE AUTH] Connected to Supabase Auth Authority at ' + supabaseUrl);
} else {
  console.warn('[SUPABASE AUTH] Service role key missing; operating in local mode.');
}

// Security Middleware: Headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ||
    [
      'https://tiet-timetable-six.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ].join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);
if (process.env.APP_URL) {
  try { allowedOrigins.add(new URL(process.env.APP_URL).origin); } catch {}
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    callback(null, origin === undefined || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
};

app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));
app.use(cookieParser());
const connectSources = ["'self'"];
const allowLocalViteDev = process.env.NODE_ENV !== 'production' && !process.env.RENDER && !process.env.VERCEL;
if (allowLocalViteDev) {
  // Vite's React refresh preamble is inline, and its HMR client uses a separate loopback WebSocket port.
  connectSources.push('ws://localhost:*', 'ws://127.0.0.1:*');
}
const configuredSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
if (configuredSupabaseUrl) {
  try {
    const supabaseOrigin = new URL(configuredSupabaseUrl);
    connectSources.push(supabaseOrigin.origin);
    if (supabaseOrigin.protocol === 'https:') connectSources.push(`wss://${supabaseOrigin.host}`);
    if (supabaseOrigin.protocol === 'http:') connectSources.push(`ws://${supabaseOrigin.host}`);
  } catch {
    console.warn('[SECURITY] Ignoring invalid Supabase URL when constructing Content-Security-Policy.');
  }
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(allowLocalViteDev ? ["'unsafe-inline'"] : [])],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
        // Explicit allow-list; custom API hosts can be added via CSP_CONNECT_SRC.
        connectSrc: [...connectSources, ...(process.env.CSP_CONNECT_SRC || "").split(",").map(v => v.trim()).filter(Boolean)],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// CSRF defence for cookie-authenticated sessions: browsers always attach an Origin header to cross-site
// state-changing requests, so reject any whose Origin is neither same-host nor explicitly allow-listed.
// Requests without an Origin header (curl, server-to-server, test harness) are not browser CSRF vectors.
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (CSRF_SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  let sameHost = false;
  try {
    sameHost = new URL(origin).host === req.headers.host;
  } catch {
    sameHost = false;
  }
  if (sameHost || allowedOrigins.has(origin)) return next();
  return res.status(403).json({
    success: false,
    error: 'CSRF_ORIGIN_DENIED',
    message: 'Cross-origin state-changing request denied.',
  });
});
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// All academic mutations are serialized and committed before a successful response.
// That keeps the legacy in-memory UI model durable in Postgres and prevents lost updates.
interface RealtimeClient {
  res: Response;
  userId: string;
  roleCode: RoleCode;
  sectionId?: string;
  department?: string;
}
interface RealtimeEventRecord {
  id: number;
  eventId: string;
  path: string;
  sectionId?: string;
  at: string;
}
const realtimeSseClients = new Set<RealtimeClient>();
const recentRealtimeEvents: RealtimeEventRecord[] = [];
let realtimeEventSeq = 0;

function isClientAuthorizedForEvent(client: RealtimeClient, ev: RealtimeEventRecord): boolean {
  if (['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD', 'FACULTY'].includes(client.roleCode)) return true;
  if (!ev.sectionId) return true;
  return client.sectionId === ev.sectionId;
}

function broadcastRealtimeEvent(sourcePath: string, sectionId?: string): void {
  realtimeEventSeq += 1;
  const record: RealtimeEventRecord = {
    id: realtimeEventSeq,
    eventId: `evt_${realtimeEventSeq}_${crypto.randomBytes(4).toString('hex')}`,
    path: sourcePath,
    sectionId,
    at: new Date().toISOString(),
  };
  recentRealtimeEvents.push(record);
  if (recentRealtimeEvents.length > 200) recentRealtimeEvents.shift();
  if (realtimeSseClients.size === 0) return;
  const payload = `id: ${record.id}\ndata: ${JSON.stringify({ type: 'state_changed', eventId: record.eventId, path: record.path, at: record.at })}\n\n`;
  for (const client of realtimeSseClients) {
    if (!isClientAuthorizedForEvent(client, record)) continue;
    try {
      client.res.write(payload);
    } catch {
      realtimeSseClients.delete(client);
    }
  }
}

const idempotencyCache = new Map<string, { statusCode: number; body: any; expiresAt: number }>();
const PERSISTED_WRITE_PREFIXES = ['/api/academic/', '/api/timetable/', '/api/recovery/', '/api/voting/', '/api/notifications', '/api/demo/reset'];
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  const requestPath = req.originalUrl.split('?')[0];
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !PERSISTED_WRITE_PREFIXES.some((prefix) => requestPath.startsWith(prefix))) {
    return next();
  }

  const rawIdemKey = req.header('idempotency-key')?.trim();
  const idempotencyCacheKey = rawIdemKey ? `${req.method}:${requestPath}:${rawIdemKey}` : null;
  if (idempotencyCacheKey) {
    const cached = idempotencyCache.get(idempotencyCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  let release = () => {};
  const previousWrite = academicWriteQueue;
  academicWriteQueue = new Promise<void>((resolve) => { release = resolve; });
  await previousWrite;
  const before = supabaseStore.exportPersistedState();
  const originalJson = res.json.bind(res);
  let responseStarted = false;
  let persistencePending = false;
  const releaseOnce = () => {
    if (responseStarted) return;
    responseStarted = true;
    release();
  };
  res.once('finish', releaseOnce);
  req.once('aborted', () => { if (!persistencePending) releaseOnce(); });
  res.json = ((body: any) => {
    if (res.statusCode >= 400) {
      if (!(res.statusCode === 409 && body?.error === 'STATE_CONFLICT')) {
        supabaseStore.restorePersistedState(before);
      }
      releaseOnce();
      return originalJson(body);
    }
    persistencePending = true;
    void persistAcademicState().then(() => {
      const targetSectionId =
        (typeof body?.sectionId === 'string' && body.sectionId) ||
        (typeof body?.poll?.sectionId === 'string' && body.poll.sectionId) ||
        (typeof body?.session?.sectionId === 'string' && body.session.sectionId) ||
        (typeof req.body?.sectionId === 'string' && req.body.sectionId) ||
        undefined;
      broadcastRealtimeEvent(requestPath, targetSectionId);
      if (idempotencyCacheKey && res.statusCode < 400) {
        idempotencyCache.set(idempotencyCacheKey, { statusCode: res.statusCode || 200, body, expiresAt: Date.now() + 10 * 60 * 1000 });
        if (idempotencyCache.size > 2000) {
          const oldest = idempotencyCache.keys().next().value;
          if (oldest) idempotencyCache.delete(oldest);
        }
      }
      originalJson(body);
      releaseOnce();
    }).catch((error) => {
      if (!(error instanceof AcademicStateConflictError)) supabaseStore.restorePersistedState(before);
      console.error('[ACADEMIC STORE] Could not persist a change:', error instanceof Error ? error.message : 'unknown error');
      if (error instanceof AcademicStateConflictError) {
        res.status(409);
        originalJson({ success: false, error: 'STATE_CONFLICT', message: error.message });
      } else {
        res.status(503);
        originalJson({ success: false, error: 'PERSISTENCE_UNAVAILABLE', message: 'The change was not saved. Please retry.' });
      }
      releaseOnce();
    });
    return res;
  }) as Response['json'];
  next();
});

export type WorkspaceType = 'Student' | 'CR' | 'Faculty' | 'Coordinator' | 'HOD' | 'Admin';

export type RoleCode = 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'COORDINATOR' | 'HOD' | 'FACULTY' | 'CLASS_REPRESENTATIVE' | 'STUDENT';

// In-Memory Database simulating PostgreSQL + Redis session store
interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  roleCode: RoleCode;
  roleName: string;
  institutionId: string;
  institutionName: string;
  department: string;
  status: 'ACTIVE' | 'LOCKED' | 'PENDING';
  createdAt: string;
  authorizedWorkspaces?: WorkspaceType[];
  isDemoUser?: boolean;
  emailVerified?: boolean;
  profile?: Record<string, unknown>;
  lastLoginAt?: string;
}

export type { StoredSession } from './src/server/persistentStore';

export interface PendingRegistration {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roleCode: RoleCode;
  roleName: string;
  department: string;
  createdAt: string;
  status?: 'PENDING';
}

export type OneTimeTokenPurpose = 'email_verification' | 'password_reset';

interface StoredOneTimeToken {
  id: string;
  email: string;
  tokenHash: string;
  purpose: OneTimeTokenPurpose;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

interface StoredUserIdentity {
  id: string;
  userId: string;
  provider: 'google';
  providerSubject: string;
  createdAt: string;
}

// In-Memory Rate Limiter (IP & Account level)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
export function clearRateLimits() {
  persistentStore.rateLimitBuckets.clear();
  persistentStore.saveToDisk();
}

function checkRateLimit(key: string, maxAttempts = 60, windowMs = 60000): { limited: boolean; retryAfterSec?: number } {
  return persistentStore.checkRateLimit(key, maxAttempts, windowMs);
}

// Pre-authorized staff directory (auth.role_assignments)
const DEMO_ACCOUNT_PASSWORD =
  process.env.DEMO_ACCOUNT_PASSWORD ||
  (process.env.NODE_ENV === 'production' ? crypto.randomBytes(16).toString('hex') + 'A1!' : 'Thapar@2026Test');
const SEED_USER_PASSWORD =
  process.env.SEED_USER_PASSWORD ||
  (process.env.NODE_ENV === 'production' ? crypto.randomBytes(16).toString('hex') + 'T1!' : 'Thapar@2026Test');
const isProdEnvironment = process.env.NODE_ENV === 'production';

const PRE_AUTHORIZED_STAFF: Record<string, { roleCode: 'COORDINATOR' | 'FACULTY' | 'HOD' | 'COLLEGE_ADMIN'; roleName: string; department: string }> = {
  'kn.murthy@thapar.edu': { roleCode: 'COORDINATOR', roleName: 'Timetable Coordinator', department: 'Computer Science and Engineering (CSED)' },
  'a.sharma@thapar.edu': { roleCode: 'FACULTY', roleName: 'Faculty (CSED)', department: 'Computer Science and Engineering (CSED)' },
  'p.gupta@thapar.edu': { roleCode: 'FACULTY', roleName: 'Faculty (CSED)', department: 'Computer Science and Engineering (CSED)' },
  's.roy@thapar.edu': { roleCode: 'HOD', roleName: 'Head of Department', department: 'School of Mathematics' },
  'dean@thapar.edu': { roleCode: 'COLLEGE_ADMIN', roleName: 'Dean of Academic Affairs', department: 'Office of the Dean' },
  'coordinator.demo@demo.thapar.local': { roleCode: 'COORDINATOR', roleName: 'Timetable Coordinator', department: 'Computer Science and Engineering (CSED)' },
  'faculty.demo@demo.thapar.local': { roleCode: 'FACULTY', roleName: 'Faculty Member', department: 'Computer Science and Engineering (CSED)' },
  'hod.demo@demo.thapar.local': { roleCode: 'HOD', roleName: 'Head of Department', department: 'School of Mathematics' },
  'admin.demo@demo.thapar.local': { roleCode: 'COLLEGE_ADMIN', roleName: 'College Admin / Dean', department: 'Office of the Dean' },
};

// Seed initial institutional users using standard Bcrypt KDF (Non-production only)
const usersDatabase: Map<string, StoredUser> = new Map(
  [
  [
    'kn.murthy@thapar.edu',
    {
      id: 'usr-murthy',
      name: 'Dr. K. N. Murthy',
      email: 'kn.murthy@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-coordinator',
      roleCode: 'COORDINATOR',
      roleName: 'Timetable Coordinator',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Coordinator', 'Faculty'],
    },
  ],
  [
    'a.sharma@thapar.edu',
    {
      id: 'usr-sharma',
      name: 'Prof. Arvind Sharma',
      email: 'a.sharma@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-faculty',
      roleCode: 'FACULTY',
      roleName: 'Faculty Member',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Faculty'],
    },
  ],
  [
    'p.gupta@thapar.edu',
    {
      id: 'usr-gupta',
      name: 'Dr. Priya Gupta',
      email: 'p.gupta@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-faculty',
      roleCode: 'FACULTY',
      roleName: 'Faculty Member',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Faculty'],
    },
  ],
  [
    's.roy@thapar.edu',
    {
      id: 'usr-roy',
      name: 'Prof. Sunita Roy',
      email: 's.roy@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-hod',
      roleCode: 'HOD',
      roleName: 'Head of Department',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'School of Mathematics',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Coordinator', 'Faculty'],
    },
  ],
  [
    'dean@thapar.edu',
    {
      id: 'usr-dean',
      name: 'Dr. Vikram Sengupta',
      email: 'dean@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-admin',
      roleCode: 'COLLEGE_ADMIN',
      roleName: 'College Admin / Dean',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Office of the Dean',
      status: 'ACTIVE',
      createdAt: '2026-07-15T09:00:00Z',
      authorizedWorkspaces: ['Admin', 'Coordinator'],
    },
  ],
  [
    'aarav.m@thapar.edu',
    {
      id: 'usr-aarav',
      name: 'Aarav Mehta',
      email: 'aarav.m@thapar.edu',
      passwordHash: hashPasswordBcryptSync(SEED_USER_PASSWORD),
      roleId: 'role-student',
      roleCode: 'STUDENT',
      roleName: 'Student',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-10T10:00:00Z',
      authorizedWorkspaces: ['Student', 'CR'],
    },
  ],
  [
    'coordinator.demo@demo.thapar.local',
    {
      id: 'usr-demo-coordinator',
      name: 'Prof. Rajesh Khanna (Coordinator)',
      email: 'coordinator.demo@demo.thapar.local',
      passwordHash: hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD),
      roleId: 'role-coordinator',
      roleCode: 'COORDINATOR',
      roleName: 'Timetable Coordinator',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Coordinator', 'Faculty'],
      isDemoUser: true,
      profile: { facultyId: 'fac-demo-rajesh' },
    },
  ],
  [
    'faculty.demo@demo.thapar.local',
    {
      id: 'usr-demo-faculty',
      name: 'Dr. Neha Agarwal (Faculty)',
      email: 'faculty.demo@demo.thapar.local',
      passwordHash: hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD),
      roleId: 'role-faculty',
      roleCode: 'FACULTY',
      roleName: 'Faculty Member',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['Faculty'],
      profile: { facultyId: 'fac-demo-neha' },
      isDemoUser: true,
    },
  ],
  [
    'student.demo@demo.thapar.local',
    {
      id: 'usr-demo-student',
      name: 'Rohan Sharma',
      email: 'student.demo@demo.thapar.local',
      passwordHash: hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD),
      roleId: 'role-student',
      roleCode: 'STUDENT',
      roleName: 'Student',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Computer Science and Engineering (CSED)',
      status: 'ACTIVE',
      createdAt: '2026-08-10T10:00:00Z',
      authorizedWorkspaces: ['Student'],
      profile: { rollNumber: '102303999', sectionId: 'sec-cse-a', subSectionId: 'sub-sec-cse-a-1' },
      isDemoUser: true,
    },
  ],
  [
    'admin.demo@demo.thapar.local',
    {
      id: 'usr-demo-admin',
      name: 'Dr. Vikram Sengupta (Dean/Admin)',
      email: 'admin.demo@demo.thapar.local',
      passwordHash: hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD),
      roleId: 'role-admin',
      roleCode: 'COLLEGE_ADMIN',
      roleName: 'College Admin / Dean',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'Office of the Dean',
      status: 'ACTIVE',
      createdAt: '2026-07-15T09:00:00Z',
      authorizedWorkspaces: ['Admin', 'Coordinator'],
      isDemoUser: true,
    },
  ],
  [
    'hod.demo@demo.thapar.local',
    {
      id: 'usr-demo-hod',
      name: 'Dr. Sunita Rao (HOD)',
      email: 'hod.demo@demo.thapar.local',
      passwordHash: hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD),
      roleId: 'role-hod',
      roleCode: 'HOD',
      roleName: 'Head of Department',
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      department: 'School of Mathematics',
      status: 'ACTIVE',
      createdAt: '2026-08-01T09:00:00Z',
      authorizedWorkspaces: ['HOD', 'Faculty'],
      profile: { facultyId: 'fac-demo-hod' },
      isDemoUser: true,
    },
  ],
]);

// Production keeps the demo identities available for the explicitly enabled
// demo-login flow, while excluding every seeded institutional account.
if (isProdEnvironment) {
  for (const [email, user] of usersDatabase) {
    if (!user.isDemoUser) usersDatabase.delete(email);
  }
}

const oneTimeTokensDatabase = persistentStore.oneTimeTokens;
const pendingRegistrationsDatabase = persistentStore.pendingRegistrations;
const userIdentitiesDatabase: Map<string, StoredUserIdentity> = new Map();
const googleOAuthStates: Map<string, { createdAt: number }> = new Map();

async function createDurableSession(rawToken: string, user: StoredUser): Promise<boolean> {
  try {
    persistentStore.createSession(rawToken, user.id, user.roleCode);
    await persistentStore.persistSession(rawToken);
    return true;
  } catch (err) {
    try {
      await persistentStore.revokeSessionDurably(rawToken);
    } catch (revokeErr) {
      console.error('[AUTH] Could not persist failed-session revocation:', revokeErr instanceof Error ? revokeErr.message : 'unknown error');
    }
    console.error('[AUTH] Could not persist login session:', err instanceof Error ? err.message : 'unknown error');
    return false;
  }
}

async function loadPersistedUsers() {
  if (!academicDb) return;
  const rows = await academicDb.query<any>(
    'select id, email, name, role_code, department, password_hash, google_sub, status, is_demo, profile, created_at, last_login_at from intellischedule.users',
  );
  for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email || !row.id) continue;
    const existing = usersDatabase.get(email);
    const user: StoredUser = {
      ...existing,
      id: String(row.id),
      name: String(row.name || existing?.name || email.split('@')[0]),
      email,
      passwordHash: row.password_hash || 'SUPABASE_AUTH_MANAGED',
      roleId: `role-${String(row.role_code || 'STUDENT').toLowerCase()}`,
      roleCode: row.role_code || 'STUDENT',
      roleName: existing?.roleName || (row.role_code === 'COORDINATOR' ? 'Timetable Coordinator' : row.role_code === 'FACULTY' ? 'Faculty Member' : row.role_code === 'COLLEGE_ADMIN' ? 'College Admin / Dean' : row.role_code === 'HOD' ? 'Head of Department' : 'Student'),
      institutionId: existing?.institutionId || 'inst-thapar',
      institutionName: existing?.institutionName || 'Thapar Institute of Engineering and Technology',
      department: String(row.department || existing?.department || ''),
      status: row.status === 'LOCKED' ? 'LOCKED' : row.status === 'PENDING' ? 'PENDING' : 'ACTIVE',
      createdAt: new Date(row.created_at || existing?.createdAt || Date.now()).toISOString(),
      authorizedWorkspaces: existing?.authorizedWorkspaces,
      isDemoUser: Boolean(row.is_demo),
      emailVerified: true,
      profile: row.profile && typeof row.profile === 'object' ? row.profile : existing?.profile || {},
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : existing?.lastLoginAt,
    };
    usersDatabase.set(email, user);
  }
}

async function persistUserRecord(user: StoredUser) {
  if (!academicDb) {
    if (process.env.NODE_ENV === 'production') throw new Error('Database is not initialized; account changes cannot be saved.');
    return;
  }
  await academicDb.query(
    `insert into intellischedule.users
       (id, email, name, role_code, department, password_hash, status, is_demo, profile, created_at, last_login_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     on conflict (email) do update set
       id = excluded.id, name = excluded.name, role_code = excluded.role_code,
       department = excluded.department,
       password_hash = excluded.password_hash,
       status = excluded.status, is_demo = excluded.is_demo, profile = excluded.profile,
       last_login_at = coalesce(excluded.last_login_at, intellischedule.users.last_login_at)`,
    [
      user.id,
      user.email.trim().toLowerCase(),
      user.name,
      user.roleCode,
      user.department,
      user.passwordHash === 'SUPABASE_AUTH_MANAGED' ? null : user.passwordHash,
      user.status,
      Boolean(user.isDemoUser),
      JSON.stringify(user.profile || {}),
      user.createdAt,
      user.lastLoginAt || null,
    ],
  );
}

async function persistNewUserRecord(user: StoredUser) {
  if (!academicDb) {
    if (process.env.NODE_ENV === 'production') throw new Error('Database is not initialized; account changes cannot be saved.');
    return;
  }
  await academicDb.query(
    `insert into intellischedule.users
       (id, email, name, role_code, department, password_hash, status, is_demo, profile, created_at, last_login_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
    [
      user.id,
      user.email.trim().toLowerCase(),
      user.name,
      user.roleCode,
      user.department,
      user.passwordHash === 'SUPABASE_AUTH_MANAGED' ? null : user.passwordHash,
      user.status,
      Boolean(user.isDemoUser),
      JSON.stringify(user.profile || {}),
      user.createdAt,
      user.lastLoginAt || null,
    ],
  );
}

async function deletePersistedUser(userId: string) {
  if (!academicDb) {
    if (process.env.NODE_ENV === 'production') throw new Error('Database is not initialized; account changes cannot be saved.');
    return;
  }
  await academicDb.tx(async (query) => {
    await query('delete from intellischedule.sessions where user_id = $1', [userId]);
    await query('delete from intellischedule.users where id = $1', [userId]);
  });
}

function issueOneTimeToken(
  email: string,
  purpose: OneTimeTokenPurpose,
  ttlMs: number
): { rawToken: string; record: StoredOneTimeToken } {
  return persistentStore.issueOneTimeToken(email, purpose, ttlMs);
}

function validateOneTimeToken(rawToken: string, expectedPurpose: OneTimeTokenPurpose): StoredOneTimeToken | null {
  return persistentStore.validateOneTimeToken(rawToken, expectedPurpose);
}

function resolveWorkspacesForUser(user: StoredUser): WorkspaceType[] {
  withDemoFacultyLink(user);
  if (user.authorizedWorkspaces && user.authorizedWorkspaces.length > 0) {
    return user.authorizedWorkspaces;
  }
  switch (user.roleCode) {
    case 'COORDINATOR':
      return ['Coordinator', 'Faculty'];
    case 'FACULTY':
      return ['Faculty'];
    case 'HOD':
      return ['HOD', 'Faculty'];
    case 'COLLEGE_ADMIN':
    case 'SUPER_ADMIN':
      return ['Admin', 'Coordinator'];
    case 'CLASS_REPRESENTATIVE':
      return ['Student', 'CR'];
    case 'STUDENT':
    default:
      return user.id === 'usr-aarav' ? ['Student', 'CR'] : ['Student'];
  }
}

function mapRoleCodeToDashboard(roleCode: string): 'Coordinator' | 'Faculty' | 'HOD' | 'Admin' | 'Student' {
  switch (roleCode) {
    case 'COORDINATOR':
      return 'Coordinator';
    case 'FACULTY':
      return 'Faculty';
    case 'HOD':
      return 'HOD';
    case 'COLLEGE_ADMIN':
    case 'SUPER_ADMIN':
      return 'Admin';
    case 'STUDENT':
    default:
      return 'Student';
  }
}

// -------------------------------------------------------------
// HEALTH CHECKS (Layer 14 - Monitoring & Operational Soundness)
// -------------------------------------------------------------
app.get('/api/health/live', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    status: 'LIVE',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'intellischedule-core',
  });
});

app.get('/api/health/ready', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const dbUsersCount = usersDatabase.size;
  const activeSessionsCount = persistentStore.sessions.size;
  let academicDatabase: 'OK' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (academicDb) {
    try {
      await academicDb.query('select 1');
      academicDatabase = 'OK';
    } catch {
      academicDatabase = 'UNAVAILABLE';
    }
  }
  const ready = academicDatabase === 'OK' || process.env.NODE_ENV !== 'production';
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'READY' : 'DATABASE_UNAVAILABLE',
    timestamp: new Date().toISOString(),
    checks: {
      inMemoryDatabase: 'OK',
      academicDatabase,
      userStoreCount: dbUsersCount,
      activeSessions: activeSessionsCount,
      rateLimiter: 'OK',
    },
  });
});

// Test helper: Reset rate limits for automated CI/regression suites (Non-production only)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/reset-rate-limits', (_req: Request, res: Response) => {
    clearRateLimits();
    return res.json({ success: true, message: 'Rate limit buckets cleared.' });
  });
}

// Ensure Supabase Auth users on server startup (Never run in production)
async function ensureSupabaseAuthUsers() {
  if (process.env.NODE_ENV === 'production') return;
  if (!supabaseAdmin) return;
  try {
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingMap = new Map((usersList?.users || []).map(u => [u.email?.toLowerCase(), u]));

    // 1. Ensure institution exists in Supabase
    await supabaseAdmin.from('institutions').upsert({
      id: 'inst-thapar',
      name: 'Thapar Institute of Engineering and Technology',
      code: 'TIET',
      domain: 'thapar.edu',
      status: 'ACTIVE',
      location: 'Patiala, Punjab',
      established_year: 1956,
    });

    // 2. Ensure roles exist
    const defaultRoles = [
      { id: 'role-super_admin', code: 'SUPER_ADMIN', name: 'Super Administrator' },
      { id: 'role-college_admin', code: 'COLLEGE_ADMIN', name: 'Dean / Administrator' },
      { id: 'role-coordinator', code: 'COORDINATOR', name: 'Timetable Coordinator' },
      { id: 'role-hod', code: 'HOD', name: 'Head of Department' },
      { id: 'role-faculty', code: 'FACULTY', name: 'Faculty Member' },
      { id: 'role-class_representative', code: 'CLASS_REPRESENTATIVE', name: 'Class Representative' },
      { id: 'role-student', code: 'STUDENT', name: 'Student' },
    ];
    for (const r of defaultRoles) {
      await supabaseAdmin.from('roles').upsert(r);
    }

    // 3. Seed users into auth.users and public.profiles
    for (const [email, user] of usersDatabase.entries()) {
      const defaultPassword = user.isDemoUser ? DEMO_ACCOUNT_PASSWORD : SEED_USER_PASSWORD;
      const existing = existingMap.get(email.toLowerCase());

      let authId = user.id;
      if (!existing) {
        const { data: created } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            roleCode: user.roleCode,
            roleName: user.roleName,
            department: user.department,
            isDemoUser: Boolean(user.isDemoUser),
          },
        });
        if (created?.user) {
          authId = created.user.id;
          user.id = authId;
        }
      } else {
        // NEVER update password for existing users
        authId = existing.id;
        user.id = authId;
      }

      // Upsert profile in Supabase public.profiles
      await supabaseAdmin.from('profiles').upsert({
        id: authId,
        email: user.email,
        name: user.name,
        institution_id: 'inst-thapar',
        department: user.department,
        role_code: user.roleCode,
        role_name: user.roleName,
        authorized_workspaces: resolveWorkspacesForUser(user),
        is_demo_user: Boolean(user.isDemoUser),
        status: user.status,
      });
    }

    console.info('[SUPABASE AUTH] Synchronized baseline institutional and demo users into auth.users and public.profiles.');
  } catch (err: any) {
    console.warn('[SUPABASE AUTH] User bootstrap sync notice:', err?.message || err);
  }
}

// -------------------------------------------------------------
// POST /api/auth/login (Authoritative Supabase Auth Verification)
// -------------------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { email, password } = req.body;

  // Validate format
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Both institutional email and password are required.',
    });
  }
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Rate Limiting Protection (Applied BEFORE credential checks)
  const isDemo = normalizedEmail.endsWith('@demo.thapar.local');
  const ipCheck = checkRateLimit(`login_ip_${clientIp}`, isDemo ? 120 : 30, 60000);
  const accountCheck = checkRateLimit(`login_acc_${normalizedEmail}`, isDemo ? 120 : 15, 60000);

  if (ipCheck.limited || accountCheck.limited) {
    const retrySec = ipCheck.retryAfterSec || accountCheck.retryAfterSec || 60;
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${retrySec} seconds.`,
      retryAfter: retrySec,
    });
  }

  let user = usersDatabase.get(normalizedEmail);

  if (pendingRegistrationsDatabase.has(normalizedEmail)) {
    const pending = pendingRegistrationsDatabase.get(normalizedEmail)!;
    const passwordCheck = await verifyPassword(String(password), pending.passwordHash);
    if (!passwordCheck.isValid) {
      return res.status(401).json({ success: false, message: 'Invalid institutional credentials. Please check your email and password.' });
    }
    return res.status(403).json({
      success: false,
      error: 'ACCOUNT_PENDING_APPROVAL',
      message: 'Waiting for Admin Approval. Your account will be available after an administrator approves your request.',
    });
  }

  if (user && user.passwordHash !== 'SUPABASE_AUTH_MANAGED') {
    if (user.isDemoUser && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true' && (user.roleCode === 'COLLEGE_ADMIN' || user.roleCode === 'COORDINATOR')) {
      return res.status(403).json({
        success: false,
        message: 'Administrative and coordinator demo accounts are prohibited in production.',
      });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({ success: false, error: 'ACCOUNT_PENDING_APPROVAL', message: 'Waiting for Admin Approval. Your account will be available after an administrator approves your request.' });
    }
    if (user.status === 'LOCKED') {
      return res.status(403).json({
        success: false,
        message: 'This account has been administratively locked. Contact Dean of Academic Affairs.',
      });
    }

    if (user.emailVerified === false) {
      return res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials. Please check your email and password.',
      });
    }

    const passwordVerification = await verifyPassword(String(password), user.passwordHash);
    if (!passwordVerification.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials. Please check your email and password.',
      });
    }

    if (passwordVerification.needsRehash) {
      user.passwordHash = hashPasswordBcryptSync(String(password));
      usersDatabase.set(normalizedEmail, user);
    }

    user.lastLoginAt = new Date().toISOString();
    try {
      await persistUserRecord(user);
    } catch (err) {
      console.error('[AUTH] Could not persist account login state:', err instanceof Error ? err.message : 'unknown error');
      return res.status(503).json({ success: false, message: 'Your account could not be loaded from durable storage. Please retry.' });
    }

    const sessionToken = 'jwt_live_' + crypto.randomBytes(32).toString('hex');
    if (!(await createDurableSession(sessionToken, user))) {
      return res.status(503).json({ success: false, message: 'Could not save your login session. Please retry.' });
    }

    res.cookie('intellischedule_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    const roleKey = mapRoleCodeToDashboard(user.roleCode);
    const authorizedWorkspaces = resolveWorkspacesForUser(user);

    return res.json({
      success: true,
      message: `Welcome, ${user.name}`,
      role: roleKey,
      roleCode: user.roleCode,
      roleName: user.roleName,
      authorizedWorkspaces,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        institution: user.institutionName,
        authorizedWorkspaces,
        isDemoUser: Boolean(user.isDemoUser),
        profile: user.profile || {},
      },
    });
  }

  // 1. Authoritative Supabase Auth Verification
  const authClient = supabaseAnon || supabaseAdmin;
  if (authClient) {
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(password),
    });

    if (authError || !authData?.user || !authData?.session) {
      // Do not put account identifiers or provider error details in production logs.
      console.info('[SUPABASE AUTH] Password login failed.');
      return res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials. Please check your email and password.',
      });
    }

    const authUser = authData.user;
    const sessionToken = authData.session.access_token || ('jwt_live_' + crypto.randomBytes(32).toString('hex'));

    let user = usersDatabase.get(normalizedEmail);
    if (!user) {
      // Look up profile from Supabase profiles table (roles are server-authoritative)
      let profileRoleCode: RoleCode | undefined;
      let profileRoleName: string | undefined;
      let profileDepartment: string | undefined;
      let profileName: string | undefined;
      let profileIsDemo: boolean = false;

      if (supabaseAdmin) {
        try {
          const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
          if (profile) {
            profileRoleCode = profile.role_code as RoleCode;
            profileRoleName = profile.role_name;
            profileDepartment = profile.department;
            profileName = profile.name;
            profileIsDemo = Boolean(profile.is_demo_user);
          }
        } catch {}
      }

      const preAuth = PRE_AUTHORIZED_STAFF[normalizedEmail];
      const roleCode: RoleCode =
        profileRoleCode ||
        (preAuth ? preAuth.roleCode : 'STUDENT');
      const roleName =
        profileRoleName ||
        (preAuth ? preAuth.roleName : (roleCode === 'COORDINATOR' ? 'Timetable Coordinator' : roleCode === 'FACULTY' ? 'Faculty Member' : roleCode === 'COLLEGE_ADMIN' ? 'College Admin / Dean' : roleCode === 'HOD' ? 'Head of Department' : 'Student'));
      const department =
        profileDepartment ||
        (preAuth ? preAuth.department : 'Computer Science and Engineering (CSED)');
      const name =
        profileName ||
        normalizedEmail.split('@')[0].toUpperCase();

      user = {
        id: authUser.id,
        name,
        email: normalizedEmail,
        passwordHash: 'SUPABASE_AUTH_MANAGED',
        roleId: 'role-' + roleCode.toLowerCase(),
        roleCode,
        roleName,
        institutionId: 'inst-thapar',
        institutionName: 'Thapar Institute of Engineering and Technology',
        department,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        isDemoUser: profileIsDemo,
      };
      usersDatabase.set(normalizedEmail, user);
    } else {
      user.id = authUser.id;
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({ success: false, error: 'ACCOUNT_PENDING_APPROVAL', message: 'Waiting for Admin Approval. Your account will be available after an administrator approves your request.' });
    }
    if (user.status === 'LOCKED') {
      return res.status(403).json({ success: false, message: 'This account has been administratively locked. Contact Dean of Academic Affairs.' });
    }

    user.lastLoginAt = new Date().toISOString();
    try {
      await persistUserRecord(user);
    } catch (err) {
      console.error('[AUTH] Could not persist Supabase-authenticated account:', err instanceof Error ? err.message : 'unknown error');
      return res.status(503).json({ success: false, message: 'Your account could not be saved to the application database. Please retry.' });
    }

    if (user.isDemoUser && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true' && (user.roleCode === 'COLLEGE_ADMIN' || user.roleCode === 'COORDINATOR')) {
      return res.status(403).json({
        success: false,
        message: 'Administrative and coordinator demo accounts are prohibited in production.',
      });
    }

    // Upsert public profile
    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        email: normalizedEmail,
        name: user.name,
        institution_id: 'inst-thapar',
        department: user.department,
        role_code: user.roleCode,
        role_name: user.roleName,
        authorized_workspaces: resolveWorkspacesForUser(user),
        is_demo_user: Boolean(user.isDemoUser),
        status: user.status,
      });
    }

    // Generate session
    if (!(await createDurableSession(sessionToken, user))) {
      return res.status(503).json({ success: false, message: 'Could not save your login session. Please retry.' });
    }

    res.cookie('intellischedule_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    const roleKey = mapRoleCodeToDashboard(user.roleCode);
    const authorizedWorkspaces = resolveWorkspacesForUser(user);

    return res.json({
      success: true,
      message: `Welcome, ${user.name}`,
      role: roleKey,
      roleCode: user.roleCode,
      roleName: user.roleName,
      authorizedWorkspaces,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        institution: user.institutionName,
        authorizedWorkspaces,
        isDemoUser: Boolean(user.isDemoUser),
        profile: user.profile || {},
      },
    });
  }

  // Fallback if Supabase not configured in local testing
  user = usersDatabase.get(normalizedEmail);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid institutional credentials. Please check your email and password.',
    });
  }

  if (user.isDemoUser && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true' && (user.roleCode === 'COLLEGE_ADMIN' || user.roleCode === 'COORDINATOR')) {
    return res.status(403).json({
      success: false,
      message: 'Administrative and coordinator demo accounts are prohibited in production.',
    });
  }

  if (user.status === 'PENDING') {
    return res.status(403).json({ success: false, error: 'ACCOUNT_PENDING_APPROVAL', message: 'Waiting for Admin Approval. Your account will be available after an administrator approves your request.' });
  }
  if (user.status === 'LOCKED') {
    return res.status(403).json({
      success: false,
      message: 'This account has been administratively locked. Contact Dean of Academic Affairs.',
    });
  }

  if (user.emailVerified === false) {
    return res.status(401).json({
      success: false,
      message: 'Invalid institutional credentials. Please check your email and password.',
    });
  }

  const passwordVerification = await verifyPassword(String(password), user.passwordHash);
  if (!passwordVerification.isValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid institutional credentials. Please check your email and password.',
    });
  }

  if (passwordVerification.needsRehash) {
    user.passwordHash = hashPasswordBcryptSync(String(password));
    usersDatabase.set(normalizedEmail, user);
  }

  const sessionToken = 'jwt_live_' + crypto.randomBytes(32).toString('hex');
  if (!(await createDurableSession(sessionToken, user))) {
    return res.status(503).json({ success: false, message: 'Could not save your login session. Please retry.' });
  }

  res.cookie('intellischedule_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  const roleKey = mapRoleCodeToDashboard(user.roleCode);
  const authorizedWorkspaces = resolveWorkspacesForUser(user);

  return res.json({
    success: true,
    message: `Welcome, ${user.name}`,
    role: roleKey,
    roleCode: user.roleCode,
    roleName: user.roleName,
    authorizedWorkspaces,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      institution: user.institutionName,
      authorizedWorkspaces,
      isDemoUser: Boolean(user.isDemoUser),
      profile: user.profile || {},
    },
  });
});

// -------------------------------------------------------------
// GET /api/auth/me (Session Verification)
// -------------------------------------------------------------
app.get('/api/auth/me', async (req: Request, res: Response) => {
  const auth = await authenticateRequestAsync(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ authenticated: false });
  }

  const foundUser = auth.user;
  const roleKey = mapRoleCodeToDashboard(foundUser.roleCode);
  const authorizedWorkspaces = resolveWorkspacesForUser(foundUser);

  return res.json({
    authenticated: true,
    user: {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      department: foundUser.department,
      institution: foundUser.institutionName,
      authorizedWorkspaces,
      isDemoUser: Boolean(foundUser.isDemoUser),
      profile: foundUser.profile || {},
    },
    role: roleKey,
    roleCode: foundUser.roleCode,
    roleName: foundUser.roleName,
    authorizedWorkspaces,
  });
});

// -------------------------------------------------------------
// POST /api/auth/logout
// -------------------------------------------------------------
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/, '') ||
    req.cookies?.intellischedule_session ||
    (req.headers.cookie?.match(/intellischedule_session=([^;]+)/)?.[1]);

  if (token) {
    try {
      await persistentStore.revokeSessionDurably(token);
    } catch (err) {
      console.error('[AUTH] Could not persist logout revocation:', err instanceof Error ? err.message : 'unknown error');
      res.clearCookie('intellischedule_session', { path: '/' });
      return res.status(503).json({ success: false, message: 'Sign-out could not be confirmed. Please try again.' });
    }
  }

  if (supabaseAnon) {
    await supabaseAnon.auth.signOut().catch(() => {});
  }

  res.clearCookie('intellischedule_session', { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// USER CONTEXT & RBAC API ENDPOINTS
// -------------------------------------------------------------

function getAuthenticatedUser(req: Request): StoredUser | null {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/, '') ||
    req.cookies?.intellischedule_session ||
    (req.headers.cookie?.match(/intellischedule_session=([^;]+)/)?.[1]);

  if (!token) return null;
  const session = persistentStore.getSession(token);
  if (!session) return null;

  for (const user of usersDatabase.values()) {
    if (user.id === session.userId) return withDemoFacultyLink(user);
  }
  return null;
}

function withDemoFacultyLink(user: StoredUser): StoredUser {
  if (user.isDemoUser && user.roleCode === 'COORDINATOR' && user.email.toLowerCase() === 'coordinator.demo@demo.thapar.local' && !user.profile?.facultyId) {
    user.profile = { ...(user.profile || {}), facultyId: 'fac-demo-rajesh' };
  }
  return user;
}

app.put('/api/auth/profile', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Please sign in to update your profile.' });

  const fields = ['phone', 'officeLocation', 'officeHours'] as const;
  const nextProfile = { ...(user.profile || {}) };
  for (const field of fields) {
    if (req.body?.[field] === undefined) continue;
    if (typeof req.body[field] !== 'string' || req.body[field].length > 200) {
      return res.status(400).json({ success: false, message: `${field} must be text with at most 200 characters.` });
    }
    nextProfile[field] = req.body[field].trim();
  }

  const previousProfile = user.profile;
  user.profile = nextProfile;
  try {
    await persistUserRecord(user);
  } catch (err) {
    user.profile = previousProfile;
    console.error('[AUTH] Could not persist profile update:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Profile changes could not be saved. Please retry.' });
  }
  usersDatabase.set(user.email.toLowerCase(), user);

  return res.json({
    success: true,
    message: 'Profile updated and saved.',
    user: { id: user.id, name: user.name, email: user.email, department: user.department, profile: user.profile },
  });
});

// GET /api/me (Current Authenticated User Profile)
app.get('/api/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Please sign in to continue.' });
  }

  const roleKey = mapRoleCodeToDashboard(user.roleCode);
  const authorizedWorkspaces = resolveWorkspacesForUser(user);

  let studentRecord: any = null;
  let facultyRecord: any = null;
  const bootstrap = supabaseStore.getBootstrapState();

  if (user.roleCode === 'STUDENT' || user.roleCode === 'CLASS_REPRESENTATIVE') {
    const students = bootstrap.students || [];
    studentRecord = students.find((s: any) => s.email?.toLowerCase() === user.email.toLowerCase());
  } else if (user.roleCode === 'FACULTY' || user.roleCode === 'COORDINATOR' || user.roleCode === 'HOD') {
    const faculty = bootstrap.facultyMembers || [];
    facultyRecord = faculty.find((f: any) => f.email?.toLowerCase() === user.email.toLowerCase() || f.id === user.profile?.facultyId);
  }
  const profile = user.profile || {};

  return res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      institution: user.institutionName,
      roleCode: user.roleCode,
      roleName: user.roleName,
      roleKey,
      authorizedWorkspaces,
      program: studentRecord?.programCode || profile.programCode || profile.program,
      semester: studentRecord?.semester ?? profile.semester,
      section: studentRecord?.sectionName || studentRecord?.sectionId || profile.sectionName || profile.sectionId,
      rollNumber: studentRecord?.studentId || profile.rollNumber,
      employeeId: facultyRecord?.employeeId || profile.employeeId,
      designation: facultyRecord?.designation || profile.designation,
    },
  });
});

// GET /api/me/timetable (Authenticated User's Schedule)
app.get('/api/me/timetable', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Please sign in to continue.' });
  }

  const bootstrap = supabaseStore.getBootstrapState();
  const scoped = sanitizeAcademicState(bootstrap, user.roleCode, user);
  let filteredSessions: any[] = scoped.sessions || [];
  let userSection = '';
  if (user.roleCode === 'STUDENT' || user.roleCode === 'CLASS_REPRESENTATIVE') {
    filteredSessions = scoped.publishedSessions || [];
    userSection = scoped.sections?.[0]?.name || '';
  } else if (user.roleCode === 'FACULTY') {
    const facultyRecord = (bootstrap.facultyMembers || []).find((f: any) => f.email?.toLowerCase() === user.email.toLowerCase() || f.id === user.profile?.facultyId);
    filteredSessions = (scoped.publishedSessions?.length ? scoped.publishedSessions : scoped.sessions || []).filter((s: any) => s.facultyId === facultyRecord?.id);
  } else if (user.roleCode === 'HOD') {
    filteredSessions = scoped.publishedSessions || [];
  }

  const schedule = filteredSessions.slice(0, 50).map((s: any) => {
    const course = scoped.courses.find((c: any) => c.id === s.courseId);
    const room = scoped.rooms.find((r: any) => r.id === s.roomId);
    const facultyMember = scoped.facultyMembers.find((f: any) => f.id === s.facultyId);
    return {
      day: s.day,
      timeSlot: s.timeSlotId,
      courseCode: course?.code || s.courseId,
      courseName: course?.name || 'Class Session',
      room: room?.name || s.roomId,
      faculty: facultyMember?.name || s.facultyId,
      status: s.status || 'Confirmed',
    };
  });

  return res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      roleCode: user.roleCode,
      section: userSection,
    },
    schedule: schedule.length > 0 ? schedule : [
      { day: 'Monday', timeSlot: '08:00 - 09:00', courseCode: 'CS501', courseName: 'Data Structures', room: 'LT101', faculty: 'Prof. Arvind Sharma', status: 'Confirmed' }
    ],
  });
});

// -------------------------------------------------------------
// GET /api/demo/status (Demo Configuration & Roles)
// -------------------------------------------------------------
app.get('/api/demo/status', (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const allowInProd = process.env.ALLOW_DEMO_IN_PRODUCTION === 'true';
  const enabled = process.env.PUBLIC_DEMO_ENABLED === 'true' && (!isProd || allowInProd);
  let accounts = [
    {
      roleKey: 'Coordinator',
      label: 'Coordinator',
      email: 'coordinator.demo@demo.thapar.local',
      name: 'Prof. Rajesh Khanna',
      department: 'Computer Science & Engineering',
      description: 'Master academic scheduling, solver orchestration, conflict review & publishing',
    },
    {
      roleKey: 'Faculty',
      label: 'Faculty',
      email: 'faculty.demo@demo.thapar.local',
      name: 'Dr. Neha Agarwal',
      department: 'Computer Science & Engineering',
      description: 'Personal teaching timetable, room & section allocations, availability blocks',
    },
    {
      roleKey: 'Student',
      label: 'Student',
      email: 'student.demo@demo.thapar.local',
      name: 'Rohan Sharma',
      department: 'B.Tech CSE - Section A',
      description: 'Weekly student class routine, room assignments & faculty details',
    },
    {
      roleKey: 'Admin',
      label: 'Admin',
      email: 'admin.demo@demo.thapar.local',
      name: 'Dr. Vikram Sengupta',
      department: 'Office of the Dean',
      description: 'Institutional regulatory profiles, master timetable publishing & governance',
    },
    {
      roleKey: 'HOD',
      label: 'HOD',
      email: 'hod.demo@demo.thapar.local',
      name: 'Dr. Sunita Rao',
      department: 'School of Mathematics',
      description: 'Departmental faculty load balance, syllabus progress & elective management',
    },
  ];

  if (isProd && !allowInProd) {
    accounts = accounts.filter(a => a.roleKey !== 'Admin' && a.roleKey !== 'Coordinator');
  }

  return res.json({
    success: true,
    enabled,
    accounts,
  });
});

// -------------------------------------------------------------
// POST /api/auth/demo-login (Server-Authoritative Demo Authentication)
// -------------------------------------------------------------
app.post('/api/auth/demo-login', async (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const allowInProd = process.env.ALLOW_DEMO_IN_PRODUCTION === 'true';

  if (isProd && !allowInProd) {
    return res.status(403).json({
      success: false,
      message: 'Demo login is prohibited in production environment.',
    });
  }

  const isDemoEnabled = process.env.PUBLIC_DEMO_ENABLED === 'true';
  if (!isDemoEnabled) {
    return res.status(403).json({
      success: false,
      message: 'Public demo access is currently disabled by administrator configuration.',
    });
  }

  const { roleKey } = req.body;
  if (isProd && !allowInProd && (roleKey === 'Admin' || roleKey === 'Coordinator')) {
    return res.status(403).json({
      success: false,
      message: 'Administrative and coordinator demo roles are prohibited in production.',
    });
  }

  const roleEmailMap: Record<string, string> = {
    Coordinator: 'coordinator.demo@demo.thapar.local',
    Faculty: 'faculty.demo@demo.thapar.local',
    Student: 'student.demo@demo.thapar.local',
    Admin: 'admin.demo@demo.thapar.local',
    HOD: 'hod.demo@demo.thapar.local',
  };

  const targetEmail = roleEmailMap[roleKey];
  if (!targetEmail) {
    return res.status(400).json({
      success: false,
      message: 'Invalid demo role requested.',
    });
  }

  let sessionToken = 'jwt_demo_' + crypto.randomBytes(32).toString('hex');
  let authUserId: string | undefined = undefined;

  if (supabaseAnon) {
    const { data: authData, error: authErr } = await supabaseAnon.auth.signInWithPassword({
      email: targetEmail,
      password: DEMO_ACCOUNT_PASSWORD,
    });
    if (!authErr && authData?.session?.access_token) {
      sessionToken = authData.session.access_token;
      authUserId = authData.user?.id;
    }
  }

  const user = usersDatabase.get(targetEmail);
  if (!user || !user.isDemoUser) {
    return res.status(404).json({
      success: false,
      message: 'Demo account not found in database.',
    });
  }

  if (isProd && !allowInProd && (user.roleCode === 'COLLEGE_ADMIN' || user.roleCode === 'COORDINATOR')) {
    return res.status(403).json({
      success: false,
      message: 'Administrative and coordinator demo roles are prohibited in production.',
    });
  }

  if (authUserId) {
    user.id = authUserId;
  }

  if (user.roleCode === 'STUDENT') {
    const seededStudent = supabaseStore.getBootstrapState().students?.find((student: any) => student.email?.toLowerCase() === user.email.toLowerCase());
    if (seededStudent?.name) user.name = seededStudent.name;
  }

  if (!(await createDurableSession(sessionToken, user))) {
    return res.status(503).json({ success: false, message: 'Could not save your login session. Please retry.' });
  }

  res.cookie('intellischedule_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  const resolvedRoleKey = mapRoleCodeToDashboard(user.roleCode);
  const authorizedWorkspaces = resolveWorkspacesForUser(user);

  return res.json({
    success: true,
    message: `Authenticated as ${user.name} (${user.roleName})`,
    role: resolvedRoleKey,
    roleCode: user.roleCode,
    roleName: user.roleName,
    authorizedWorkspaces,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      institution: user.institutionName,
      authorizedWorkspaces,
      isDemoUser: true,
      profile: user.profile || {},
    },
  });
});

// -------------------------------------------------------------
// POST /api/demo/reset (Safe Demo Data Reset)
// -------------------------------------------------------------
app.post('/api/demo/reset', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.authenticatedUser?.isDemoUser && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Demo reset can only be executed by authenticated demo accounts.',
    });
  }

  // Restore demo passwords and ensure pristine state
  const demoAccounts = [
    'coordinator.demo@demo.thapar.local',
    'faculty.demo@demo.thapar.local',
    'student.demo@demo.thapar.local',
    'admin.demo@demo.thapar.local',
    'hod.demo@demo.thapar.local',
  ];

  for (const email of demoAccounts) {
    const user = usersDatabase.get(email);
    if (user) {
      user.passwordHash = hashPasswordBcryptSync(DEMO_ACCOUNT_PASSWORD);
      user.status = 'ACTIVE';
      usersDatabase.set(email, user);
    }
  }

  supabaseStore.resetDemoDataset();

  return res.json({
    success: true,
    message: 'Demo dataset and accounts safely restored to pristine initial state.',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/academic/faculty/:id/availability', requireAuth, requireRole(['FACULTY', 'HOD', 'COORDINATOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { day, periodId, reason } = req.body || {};
  const facultyId = String(req.params.id);
  const allowedReasons = ['Research', 'Lunch', 'Personal', 'Department', 'Meeting'];
  if (!day || typeof day !== 'string' || !periodId || typeof periodId !== 'string' || !allowedReasons.includes(reason)) {
    return res.status(400).json({ success: false, message: 'A valid day, period, and availability reason are required.' });
  }
  const ownFacultyId = req.authenticatedUser?.profile?.facultyId;
  if (req.authenticatedUser?.roleCode === 'FACULTY' && ownFacultyId !== facultyId) {
    return res.status(403).json({ success: false, message: 'Faculty may only update their own availability.' });
  }
  const state = supabaseStore.getBootstrapState();
  const timeSlots = state.academicYear?.timeSlots || [];
  const periodIndex = timeSlots.findIndex((slot: any) => slot.id === periodId);
  const overlapsScheduledClass = (state.sessions || []).some((session: any) => {
    if (session.facultyId !== facultyId || session.day !== day || session.status === 'Cancelled') return false;
    const startIndex = timeSlots.findIndex((slot: any) => slot.id === session.timeSlotId);
    const duration = Math.max(1, Number(session.durationPeriods) || 1);
    return periodIndex >= startIndex && periodIndex < startIndex + duration;
  });
  const alreadyProtected = (state.facultyMembers || []).find((item: any) => item.id === facultyId)
    ?.preferences?.protectedSlots?.some((slot: any) => slot.day === day && slot.periodId === periodId);
  if (!alreadyProtected && overlapsScheduledClass) {
    return res.status(409).json({ success: false, message: 'This period contains a scheduled class and cannot be marked as protected.' });
  }
  const faculty = supabaseStore.toggleFacultyProtectedSlot(facultyId, day as DayOfWeek, periodId, reason);
  if (!faculty) return res.status(404).json({ success: false, message: 'Faculty record not found.' });
  return res.json({ success: true, faculty });
});

// -------------------------------------------------------------
// POST /api/auth/register (Authoritative Supabase Auth Signup)
// -------------------------------------------------------------
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ipMaxAttempts = process.env.NODE_ENV === 'test' ? 100 : 20;
  const ipRate = checkRateLimit(`register_ip_${clientIp}`, ipMaxAttempts, 60000);
  if (ipRate.limited) {
    return res.status(429).json({
      success: false,
      message: `Too many registration attempts from this IP. Please wait ${ipRate.retryAfterSec} seconds.`,
      error: 'RATE_LIMIT_EXCEEDED',
    });
  }

  const { name, email, password } = req.body;
  const requestedRoleCode = String(req.body?.roleCode || 'STUDENT') as RoleCode;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, institutional email, and password are required.',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const emailMaxAttempts = process.env.NODE_ENV === 'test' ? 100 : 5;
  const emailRate = checkRateLimit(`register_email_${normalizedEmail}`, emailMaxAttempts, 60000);
  if (emailRate.limited) {
    return res.status(429).json({
      success: false,
      message: `Too many registration attempts for this email address. Please wait ${emailRate.retryAfterSec} seconds.`,
      error: 'RATE_LIMIT_EXCEEDED',
    });
  }

  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    });
  }

  const normalizedRoleCode: RoleCode = requestedRoleCode === 'COORDINATOR' ? 'HOD' : requestedRoleCode;
  if (!['STUDENT', 'FACULTY', 'HOD'].includes(normalizedRoleCode)) {
    return res.status(400).json({ success: false, message: 'Choose Student, Faculty, or HOD as the requested role.' });
  }

  // Require allowed email domain
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'thapar.edu')
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  const emailDomain = normalizedEmail.split('@')[1];

  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return res.status(400).json({
      success: false,
      message: `Registration is only permitted for authorized institutional email domains (${allowedDomains.join(', ')}).`,
      error: 'INVALID_EMAIL_DOMAIN',
    });
  }

  // Enforce strong password policy: 12+ chars, uppercase, lowercase, number, special character
  const pwdCheck = evaluatePasswordPolicy(String(password));
  if (!pwdCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: `Password does not meet institutional security requirements: ${pwdCheck.errors.join(', ')}.`,
      errors: pwdCheck.errors,
    });
  }

  if (usersDatabase.has(normalizedEmail)) {
    return res.status(201).json({
      success: true,
      message: 'If this email already has an account, sign in with the existing password or use Forgot Password.',
      email: normalizedEmail,
      requiresLogin: true,
    });
  }
  if (pendingRegistrationsDatabase.has(normalizedEmail)) {
    return res.status(202).json({ success: true, status: 'PENDING', message: 'Your account request is already waiting for Admin Approval.', email: normalizedEmail, roleCode: pendingRegistrationsDatabase.get(normalizedEmail)?.roleCode });
  }

  // Students auto-activate immediately without manual admin approval (supports 50,000+ student scale).
  if (normalizedRoleCode === 'STUDENT') {
    let id = `usr-${crypto.randomUUID()}`;
    const trimmedName = String(name).trim();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { name: trimmedName },
      });
      if (error || !data.user) {
        return res.status(400).json({ success: false, message: error?.message || 'Could not create student account.' });
      }
      id = data.user.id;
      const profile = {
        id,
        email: normalizedEmail,
        name: trimmedName,
        institution_id: 'inst-thapar',
        department: 'Computer Science and Engineering (CSED)',
        role_code: 'STUDENT',
        role_name: ROLE_LABELS.STUDENT,
        authorized_workspaces: ['student'],
        is_demo_user: false,
        status: 'ACTIVE',
      };
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profile);
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(id);
        return res.status(503).json({ success: false, message: 'Student profile could not be saved. Please try again.' });
      }
    }
    const newStudent: StoredUser = {
      id,
      email: normalizedEmail,
      name: trimmedName,
      department: 'Computer Science and Engineering (CSED)',
      roleCode: 'STUDENT',
      roleId: 'role-student',
      roleName: ROLE_LABELS.STUDENT,
      institutionId: 'inst-thapar',
      institutionName: 'Thapar Institute of Engineering and Technology',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      passwordHash: supabaseAdmin ? 'SUPABASE_AUTH_MANAGED' : hashPasswordBcryptSync(String(password)),
      isDemoUser: false,
      emailVerified: true,
      authorizedWorkspaces: ['student'],
    };
    try {
      await persistNewUserRecord(newStudent);
      usersDatabase.set(normalizedEmail, newStudent);
      return res.status(201).json({
        success: true,
        status: 'ACTIVE',
        message: 'Student account activated immediately. Signing you in…',
        email: normalizedEmail,
        roleCode: 'STUDENT',
      });
    } catch (err) {
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('id', id);
          await supabaseAdmin.auth.admin.deleteUser(id);
        } catch {}
      }
      console.error('[REGISTRATION] Could not persist auto-activated student:', err instanceof Error ? err.message : 'unknown error');
      return res.status(503).json({ success: false, message: 'Student account could not be saved. Please try again.' });
    }
  }

  const pending: PendingRegistration = {
    id: 'preg_' + crypto.randomUUID(),
    email: normalizedEmail,
    name: String(name).trim(),
    passwordHash: hashPasswordBcryptSync(String(password)),
    roleCode: normalizedRoleCode,
    roleName: ROLE_LABELS[normalizedRoleCode],
    department: 'Computer Science and Engineering (CSED)',
    createdAt: new Date().toISOString(),
    status: 'PENDING',
  };
  try {
    persistentStore.setPendingRegistration(normalizedEmail, pending);
    await persistentStore.persistPendingRegistration(normalizedEmail);
    return res.status(202).json({
      success: true,
      status: 'PENDING',
      message: 'Privileged account request submitted for Admin review.',
      email: normalizedEmail,
      roleCode: normalizedRoleCode,
    });
  } catch (err) {
    try {
      await persistentStore.deletePendingRegistrationDurably(normalizedEmail);
    } catch (cleanupErr) {
      console.error('[REGISTRATION] Could not clean up failed approval request:', cleanupErr instanceof Error ? cleanupErr.message : 'unknown error');
    }
    console.error('[REGISTRATION] Could not persist approval request:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Registration request could not be saved. Please try again.' });
  }
});

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
  return res.status(410).json({ success: false, error: 'ADMIN_APPROVAL_REQUIRED', message: 'Email verification has been replaced by Admin approval. Your request remains pending until an administrator reviews it.' });
});

// POST /api/auth/resend-verification
app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
  return res.status(410).json({ success: false, error: 'ADMIN_APPROVAL_REQUIRED', message: 'Email verification is no longer used. Account requests are reviewed by an Admin.' });
});

// -------------------------------------------------------------
// Google OAuth 2.0 Backend Endpoints
// -------------------------------------------------------------
app.get('/api/auth/google/status', (_req: Request, res: Response) => {
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({
    configured,
    provider: 'Google OAuth 2.0 (Identity Only: openid, email, profile)',
    message: configured
      ? 'Google OAuth 2.0 is active.'
      : 'Google OAuth 2.0 is currently unconfigured (REQUIRES HUMAN ACTION: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables). Institutional email and password authentication is active.',
  });
});

function getGoogleRedirectUri(req?: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  if (process.env.APP_URL) {
    const base = process.env.APP_URL.trim().replace(/\/+$/, '');
    return `${base}/api/auth/google/callback`;
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0].trim() || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim() || req.get('host') || 'localhost:3000';
    return `${proto}://${host}/api/auth/google/callback`;
  }
  return 'http://localhost:3000/api/auth/google/callback';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initiation: GET /api/auth/google/authorize
app.get('/api/auth/google/authorize', (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(req);

  // If GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET are missing, return 503 "Google sign-in not configured"
  if (!clientId || !clientSecret) {
    if (req.headers.accept?.includes('application/json')) {
      return res.status(503).json({ success: false, message: 'Google sign-in not configured' });
    }
    return res.status(503).send('Google sign-in not configured');
  }

  const rate = checkRateLimit(`oauth_ip_${clientIp}`, 10, 60000);
  if (rate.limited) {
    return res.status(429).json({
      success: false,
      message: `Too many authorization attempts. Please wait ${rate.retryAfterSec} seconds.`,
    });
  }

  // Generate cryptographically secure random state (32 bytes = 256 bits)
  const state = crypto.randomBytes(32).toString('hex');
  googleOAuthStates.set(state, { createdAt: Date.now() });

  // Clean expired states older than 10 mins
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [st, val] of googleOAuthStates.entries()) {
    if (val.createdAt < tenMinutesAgo) {
      googleOAuthStates.delete(st);
    }
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&prompt=select_account`;

  if (req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, configured: true, redirectUrl: googleAuthUrl });
  }

  return res.redirect(googleAuthUrl);
});

// Callback: GET /api/auth/google/callback
app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const isJson = req.headers.accept?.includes('application/json');
  const { code, state, error } = req.query;
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const returnError = (status: number, message: string, errorCode = 'OAUTH_ERROR') => {
    if (isJson) {
      return res.status(status).json({ success: false, error: errorCode, message });
    }
    return res.redirect(`/?auth_error=${encodeURIComponent(message)}`);
  };

  if (error) {
    return returnError(400, 'Google sign-in was cancelled or rejected.', 'OAUTH_PROVIDER_ERROR');
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return returnError(400, 'Invalid or missing OAuth parameters.', 'INVALID_PARAMETERS');
  }

  // Validate state
  const stateRecord = googleOAuthStates.get(state);
  if (!stateRecord || Date.now() - stateRecord.createdAt > 10 * 60 * 1000) {
    googleOAuthStates.delete(state);
    return returnError(400, 'Expired or invalid OAuth session state. Please try again.', 'INVALID_STATE');
  }
  // Single-use token invalidation
  googleOAuthStates.delete(state);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(req);

  if (!clientId || !clientSecret) {
    return returnError(503, 'Google sign-in not configured', 'CONFIG_MISSING');
  }

  try {
    // Exchange code for tokens with Google
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.id_token) {
      console.warn('[GOOGLE OAUTH] Token exchange failed with Google');
      return returnError(400, 'Google sign-in could not be completed. Please try again.', 'TOKEN_EXCHANGE_FAILED');
    }

    // Verify ID Token signature using OAuth2Client.verifyIdToken
    let payload: any = null;
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokenData.id_token,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (verifyErr: any) {
      console.warn('[GOOGLE OAUTH] ID token verification failed:', verifyErr?.message || verifyErr);
      return returnError(400, 'Invalid Google ID token signature.', 'INVALID_ID_TOKEN');
    }

    if (!payload || !payload.email) {
      return returnError(400, 'Unable to determine user identity from Google ID token.', 'IDENTITY_ERROR');
    }

    if (!payload.email_verified) {
      return returnError(400, 'Google email address must be verified.', 'EMAIL_NOT_VERIFIED');
    }

    const normalizedEmail = String(payload.email).trim().toLowerCase();
    const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'thapar.edu')
      .split(',')
      .map(d => d.trim().toLowerCase().replace(/^@/, ''));
    const emailDomain = normalizedEmail.split('@')[1];

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      return returnError(403, `Google accounts outside authorized institutional domains (${allowedDomains.join(', ')}) are not permitted.`, 'UNAUTHORIZED_DOMAIN');
    }

    const sub = payload.sub;
    const name = payload.name;

    // Check institutional identity
    const identityKey = `google_${sub}`;
    let identity = userIdentitiesDatabase.get(identityKey);
    let user: StoredUser | undefined;

    if (identity) {
      for (const u of usersDatabase.values()) {
        if (u.id === identity.userId) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      user = usersDatabase.get(normalizedEmail);
      if (user) {
        userIdentitiesDatabase.set(identityKey, {
          id: 'ident_' + crypto.randomUUID(),
          userId: user.id,
          provider: 'google',
          providerSubject: sub,
          createdAt: new Date().toISOString(),
        });
      } else {
        const preAuth = PRE_AUTHORIZED_STAFF[normalizedEmail];
        const roleCode = preAuth ? preAuth.roleCode : 'STUDENT';
        const roleName = preAuth ? preAuth.roleName : 'Student';
        const department = preAuth ? preAuth.department : 'Computer Science and Engineering (CSED)';

        user = {
          id: 'usr_g_' + crypto.randomUUID(),
          name: name ? String(name).trim() : normalizedEmail.split('@')[0].toUpperCase(),
          email: normalizedEmail,
          passwordHash: hashPasswordBcryptSync('OAuth_Google_' + sub + '_' + normalizedEmail),
          roleId: 'role-' + roleCode.toLowerCase(),
          roleCode,
          roleName,
          institutionId: 'inst-thapar',
          institutionName: 'Thapar Institute of Engineering and Technology',
          department,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        usersDatabase.set(normalizedEmail, user);

        userIdentitiesDatabase.set(identityKey, {
          id: 'ident_' + crypto.randomUUID(),
          userId: user.id,
          provider: 'google',
          providerSubject: sub,
          createdAt: new Date().toISOString(),
        });
      }
    }

    user.lastLoginAt = new Date().toISOString();
    try {
      await persistUserRecord(user);
    } catch (persistError) {
      console.error('[AUTH] Could not persist Google-authenticated account:', persistError instanceof Error ? persistError.message : 'unknown error');
      return returnError(503, 'Your account could not be saved to the application database. Please retry.', 'ACCOUNT_PERSISTENCE_FAILED');
    }

    // Create session
    const sessionToken = 'jwt_live_' + crypto.randomBytes(32).toString('hex');
    if (!(await createDurableSession(sessionToken, user))) {
      return returnError(503, 'Could not save your login session. Please retry.', 'SESSION_PERSISTENCE_FAILED');
    }

    // Set cookie with same options as other login routes: sameSite: 'lax', secure in production
    res.cookie('intellischedule_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    const roleKeyMap: Record<RoleCode, string> = {
      COORDINATOR: 'Coordinator',
      FACULTY: 'Faculty',
      HOD: 'HOD',
      COLLEGE_ADMIN: 'Admin',
      SUPER_ADMIN: 'Admin',
      CLASS_REPRESENTATIVE: 'Student',
      STUDENT: 'Student',
    };
    const roleKey = roleKeyMap[user.roleCode] || 'Student';
    const authorizedWorkspaces = resolveWorkspacesForUser(user);

    if (isJson) {
      return res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, roleCode: user.roleCode },
      });
    }

    const safeEmail = escapeHtml(user.email);
    const safeRoleKey = escapeHtml(roleKey);

    return res.send(`<!DOCTYPE html><html><head><title>Authentication Complete</title><style>body{font-family:system-ui,sans-serif;background-color:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{text-align:center;background:#18181b;border:1px solid #27272a;padding:32px;border-radius:16px;}</style></head><body><div class="card"><h3 style="margin:0 0 8px 0;font-size:16px;">Signed in as ${safeEmail}</h3><p style="margin:0;font-size:13px;color:#a1a1aa;">Completing session setup and redirecting...</p></div><script>const authPayload={type:'GOOGLE_AUTH_SUCCESS',roleKey:${JSON.stringify(safeRoleKey)},authorizedWorkspaces:${JSON.stringify(authorizedWorkspaces)}};const targetOrigin=${JSON.stringify(appUrl)};if(window.opener){window.opener.postMessage(authPayload,targetOrigin);setTimeout(()=>{window.close();},400);}else{window.location.href='/';}</script></body></html>`);
  } catch (err) {
    console.error('[GOOGLE OAUTH] Exception in Google OAuth callback handler:', err);
    return returnError(400, 'Google sign-in could not be completed. Please try again.', 'CALLBACK_EXCEPTION');
  }
});

// -------------------------------------------------------------
// -------------------------------------------------------------
// POST /api/auth/forgot-password (Rate limited, anti-enumeration, secure token hash)
// -------------------------------------------------------------
async function sendResetEmail(email: string, token: string): Promise<void> {
  if (process.env.SMTP_URL || process.env.MAILER_SERVICE) {
    // Custom mailer hook behind environment variable
    return;
  }
  const authClient = supabaseAnon || supabaseAdmin;
  if (authClient) {
    try {
      await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`,
      });
    } catch (err: any) {
      console.warn('[RESET EMAIL] Supabase resetPasswordForEmail notice:', err?.message || err);
    }
  }
}

const AUTH_TIMING_FLOOR_MS = 20;

const handleForgotPassword = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Institutional email is required.',
    });
  }

  // Rate Limiting
  const rate = checkRateLimit(`forgot_ip_${clientIp}`, 5, 60000);
  if (rate.limited) {
    return res.status(429).json({
      success: false,
      message: `Too many password reset requests. Please wait ${rate.retryAfterSec} seconds.`,
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = usersDatabase.get(normalizedEmail);

  let rawToken: string | undefined = undefined;
  const dummyToken = issueOneTimeToken(normalizedEmail, 'password_reset', 15 * 60 * 1000); // 15 mins

  if (user) {
    rawToken = dummyToken.rawToken;
    const tokenToSend = rawToken;

    try {
      await persistentStore.persistOneTimeToken(rawToken);
    } catch (err) {
      console.error('[AUTH] Could not persist password reset token:', err instanceof Error ? err.message : 'unknown error');
      // Keep the public response generic, and do not send an unusable link.
      rawToken = undefined;
    }

    // Send token by email
    if (rawToken) setImmediate(() => { sendResetEmail(normalizedEmail, tokenToSend).catch(() => {}); });
  } else {
    oneTimeTokensDatabase.delete(dummyToken.record.tokenHash);
  }

  // Security requirement: Always return generic response to avoid email enumeration.
  // Never leak resetToken in production or by default.
  const responseData: Record<string, any> = {
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  };

  // Only for automated tests: return token if BOTH NODE_ENV === 'test' and ALLOW_TEST_RESET_TOKEN === 'true', NEVER in production
  if (isTestTokenAllowed(req) && rawToken) {
    responseData.resetToken = rawToken;
  }

  await new Promise(resolve => setTimeout(resolve, AUTH_TIMING_FLOOR_MS));
  return res.json(responseData);
};

app.post('/api/auth/forgot-password', handleForgotPassword);
app.post('/auth/forgot-password', handleForgotPassword);

// -------------------------------------------------------------
// GET /api/auth/validate-token
// -------------------------------------------------------------
app.get('/api/auth/validate-token', (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Reset token required.' });
  }

  const record = validateOneTimeToken(token, 'password_reset');
  if (!record) {
    return res.status(400).json({ valid: false, message: 'Invalid or expired password reset token.' });
  }

  return res.json({ valid: true, email: record.email });
});

// -------------------------------------------------------------
// POST /api/auth/reset-password
// -------------------------------------------------------------
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token and new password are required.',
    });
  }

  const pwdCheck = evaluatePasswordPolicy(String(newPassword));
  if (!pwdCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: `Password does not meet security requirements: ${pwdCheck.errors.join(', ')}.`,
      errors: pwdCheck.errors,
    });
  }

  let record: StoredOneTimeToken | null;
  try {
    record = await persistentStore.consumeOneTimeTokenDurably(token, 'password_reset');
  } catch (err) {
    console.error('[AUTH] Could not persist consumed password token:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Password reset could not be completed. Please request a new link.' });
  }
  if (!record) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired password reset token. Please request a new one.',
    });
  }
  const user = usersDatabase.get(record.email);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User account not found.',
    });
  }

  // Update password in database with modern Bcrypt KDF
  const previousPasswordHash = user.passwordHash;
  user.passwordHash = hashPasswordBcryptSync(String(newPassword));
  usersDatabase.set(record.email, user);
  try {
    await persistUserRecord(user);
  } catch (err) {
    user.passwordHash = previousPasswordHash;
    usersDatabase.set(record.email, user);
    console.error('[AUTH] Could not persist password reset:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Password reset could not be saved. Please try again.' });
  }

  // Sync password with Supabase Auth
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: String(newPassword),
      });
      if (error) throw error;
    } catch (err: any) {
      user.passwordHash = previousPasswordHash;
      usersDatabase.set(record.email, user);
      try {
        await persistUserRecord(user);
      } catch (rollbackErr) {
        console.error('[AUTH] Could not restore application password after Supabase update failure:', rollbackErr instanceof Error ? rollbackErr.message : 'unknown error');
      }
      console.error('[SUPABASE AUTH] Password update failed:', err?.message || 'unknown error');
      return res.status(503).json({ success: false, message: 'Password reset could not be synchronized with the authentication provider. Please request a new reset link.' });
    }
  }

  try {
    await Promise.all([
      persistentStore.invalidateUserTokensDurably(user.email),
      persistentStore.revokeUserSessionsDurably(user.id),
    ]);
  } catch (err) {
    console.error('[AUTH] Could not durably invalidate reset tokens and sessions:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Password was saved, but existing sessions could not be fully revoked. Please contact the administrator.' });
  }

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.auth.admin.signOut(user.id);
    } catch {}
  }

  return res.json({
    success: true,
    message: 'Your password has been reset successfully. You can now sign in with your new password.',
  });
});

// -------------------------------------------------------------
// SERVER-SIDE RBAC MIDDLEWARE & AUTHORIZATION CONTROLS
// -------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  authenticatedUser?: StoredUser;
  authenticatedSession?: StoredSession;
}

export async function authenticateRequestAsync(req: Request): Promise<{ user: StoredUser; session?: StoredSession } | null> {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.replace(/^Bearer\s+/i, '').trim() ||
    (req.headers.cookie?.match(/intellischedule_session=([^;]+)/)?.[1]);

  if (!token) return null;

  // 1. Check persistent session store
  const session = persistentStore.getSession(token);
  if (session) {
    for (const user of usersDatabase.values()) {
      if (user.id === session.userId && user.status === 'ACTIVE') {
        return { user: withDemoFacultyLink(user), session };
      }
    }
  }

  // 2. Authoritative Supabase Access Token Verification
  const authClient = supabaseAdmin || supabaseAnon;
  if (authClient) {
    try {
      const { data: authData, error: authError } = await authClient.auth.getUser(token);
      if (!authError && authData?.user) {
        const authUser = authData.user;
        const normalizedEmail = (authUser.email || '').toLowerCase().trim();

        // Retrieve profile from Supabase profiles table using auth.users.id
        let profile: any = null;
        if (supabaseAdmin) {
          const { data: p } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          profile = p;
        }

        // If not found by ID, attempt lookup by email and sync ID
        if (!profile && supabaseAdmin && normalizedEmail) {
          const { data: pByEmail } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();
          if (pByEmail) {
            profile = pByEmail;
            await supabaseAdmin.from('profiles').update({ id: authUser.id }).eq('email', normalizedEmail);
          }
        }

        const preAuth = PRE_AUTHORIZED_STAFF[normalizedEmail];
        const roleCode: RoleCode =
          (profile?.role_code as RoleCode) ||
          (preAuth ? preAuth.roleCode : 'STUDENT');
        const roleName =
          profile?.role_name ||
          (preAuth ? preAuth.roleName : (roleCode === 'COORDINATOR' ? 'Timetable Coordinator' : roleCode === 'FACULTY' ? 'Faculty Member' : roleCode === 'COLLEGE_ADMIN' ? 'College Admin / Dean' : roleCode === 'HOD' ? 'Head of Department' : 'Student'));
        const department =
          profile?.department ||
          (preAuth ? preAuth.department : 'Computer Science and Engineering (CSED)');
        const name =
          profile?.name ||
          normalizedEmail.split('@')[0].toUpperCase();

        const user: StoredUser = {
          id: authUser.id,
          name,
          email: normalizedEmail,
          passwordHash: 'SUPABASE_AUTH_MANAGED',
          roleId: 'role-' + roleCode.toLowerCase(),
          roleCode,
          roleName,
          institutionId: profile?.institution_id || 'inst-thapar',
          institutionName: 'Thapar Institute of Engineering and Technology',
          department,
          status: profile?.status === 'PENDING' ? 'PENDING' : profile?.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
          createdAt: authUser.created_at || new Date().toISOString(),
          authorizedWorkspaces: profile?.authorized_workspaces || (roleCode === 'COORDINATOR' ? ['Coordinator', 'Faculty'] : [roleCode as any]),
          isDemoUser: Boolean(profile?.is_demo_user),
          profile: profile?.profile || authUser.user_metadata?.profile || {},
        };

        withDemoFacultyLink(user);
        if (normalizedEmail) {
          usersDatabase.set(normalizedEmail, user);
        }

        if (user.status !== 'ACTIVE') return null;

        return { user };
      }
    } catch (err) {
      console.warn('[SUPABASE TOKEN VERIFICATION ERROR]', err);
    }
  }

  return null;
}

export function authenticateRequest(req: Request): { user: StoredUser; session: StoredSession } | null {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() ||
    (req.headers.cookie?.match(/intellischedule_session=([^;]+)/)?.[1]);

  if (!token) return null;

  const session = persistentStore.getSession(token);
  if (!session) {
    return null;
  }

  for (const user of usersDatabase.values()) {
    if (user.id === session.userId) {
      return { user, session };
    }
  }

  return null;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = await authenticateRequestAsync(req);
  if (!auth) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'Authentication token is missing, invalid, or expired.',
    });
  }
  req.authenticatedUser = auth.user;
  req.authenticatedSession = auth.session;
  next();
}

export function requireRole(allowedRoles: RoleCode[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authenticatedUser) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication required before permission verification.',
      });
    }

    if (!allowedRoles.includes(req.authenticatedUser.roleCode)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Access denied. Role '${req.authenticatedUser.roleCode}' lacks permission for this operation. Required: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// PROTECTED ACADEMIC & TIMETABLE APIS WITH SERVER-SIDE RBAC
// -------------------------------------------------------------

// -------------------------------------------------------------
// SUPABASE-BACKED MASTER ACADEMIC & TIMETABLE API ENDPOINTS
// -------------------------------------------------------------

function sanitizeAcademicState(state: any, roleCode?: string, user?: StoredUser) {
  if (roleCode === 'HOD') {
    const linkedFaculty = (state.facultyMembers || []).find((faculty: any) => faculty.id === user?.profile?.facultyId || faculty.email?.toLowerCase() === user?.email?.toLowerCase());
    const departmentId = linkedFaculty?.departmentId || (state.departments || []).find((department: any) => department.id === user?.department || department.name === user?.department)?.id;
    if (!departmentId) return { ...state, departments: [], programs: [], courses: [], facultyMembers: [], rooms: [], sections: [], students: [], allocations: [], constraints: [], sessions: [], publishedSessions: [], versions: [], notifications: [], polls: [], makeupTasks: [], recoveryOpportunities: [], auditLogs: [] };
    const sectionIds = new Set((state.sections || []).filter((item: any) => item.departmentId === departmentId).map((item: any) => item.id));
    const courseIds = new Set((state.courses || []).filter((item: any) => item.departmentId === departmentId).map((item: any) => item.id));
    const facultyIds = new Set((state.facultyMembers || []).filter((item: any) => item.departmentId === departmentId).map((item: any) => item.id));
    const scoped = (sessions: any[]) => (sessions || []).filter((item: any) => sectionIds.has(item.sectionId) || facultyIds.has(item.facultyId));
    return {
      ...state,
      departments: (state.departments || []).filter((item: any) => item.id === departmentId),
      programs: (state.programs || []).filter((item: any) => item.departmentId === departmentId),
      courses: (state.courses || []).filter((item: any) => courseIds.has(item.id)),
      facultyMembers: (state.facultyMembers || []).filter((item: any) => facultyIds.has(item.id)),
      rooms: (state.rooms || []).filter((item: any) => (state.sessions || []).some((session: any) => session.roomId === item.id && (sectionIds.has(session.sectionId) || facultyIds.has(session.facultyId)))),
      sections: (state.sections || []).filter((item: any) => sectionIds.has(item.id)),
      students: (state.students || []).filter((item: any) => sectionIds.has(item.sectionId)),
      studentsCount: (state.sections || []).filter((item: any) => sectionIds.has(item.id)).reduce((total: number, item: any) => total + (Number(item.studentCount) || 0), 0),
      allocations: (state.allocations || []).filter((item: any) => sectionIds.has(item.sectionId) && courseIds.has(item.courseId)),
      sessions: scoped(state.sessions), publishedSessions: scoped(state.publishedSessions),
      versions: (state.versions || []).map((version: any) => ({ ...version, sessions: scoped(version.sessions || []) })),
      polls: (state.polls || []).filter((item: any) => sectionIds.has(item.sectionId)),
      makeupTasks: (state.makeupTasks || []).filter((item: any) => sectionIds.has(item.sectionId)),
      recoveryOpportunities: (state.recoveryOpportunities || []).filter((item: any) => sectionIds.has(item.sectionId)),
      notifications: (state.notifications || []).filter((item: any) => {
        if (item.userId && item.userId !== user?.id) return false;
        if (item.actionPayload?.sectionId) return sectionIds.has(item.actionPayload.sectionId);
        const sessionId = item.actionPayload?.sessionId;
        if (sessionId) return scoped(state.sessions).some((session: any) => session.id === sessionId) || scoped(state.publishedSessions).some((session: any) => session.id === sessionId);
        const facultyId = item.actionPayload?.facultyId;
        return !facultyId || facultyIds.has(facultyId);
      }),
      auditLogs: (state.auditLogs || []).filter((log: any) =>
        (log.entityType === 'DepartmentTimetable' && String(log.entityId).startsWith(`${departmentId}:`)) ||
        (log.entityType === 'ClassSession' && (state.sessions || []).some((session: any) => session.id === log.entityId && (sectionIds.has(session.sectionId) || facultyIds.has(session.facultyId)))) ||
        (log.entityType === 'Faculty' && facultyIds.has(log.entityId)) ||
        (log.entityType === 'StudentSection' && sectionIds.has(log.entityId)) ||
        (log.entityType === 'Course' && courseIds.has(log.entityId))
      ),
    };
  }
  if (roleCode === 'FACULTY') {
    const faculty = (state.facultyMembers || []).find((item: any) => item.id === user?.profile?.facultyId || item.email?.toLowerCase() === user?.email?.toLowerCase());
    return {
      ...state,
      students: [],
      studentsCount: 0,
      facultyMembers: (state.facultyMembers || []).map((item: any) => ({
        id: item.id, name: item.name, departmentId: item.departmentId, designation: item.designation,
        subjectsQualified: item.subjectsQualified, status: item.status,
        ...(item.id === faculty?.id ? { email: item.email, preferences: item.preferences } : {}),
      })),
      auditLogs: [],
      notifications: (state.notifications || []).filter((item: any) =>
        (!item.userId || item.userId === user?.id) &&
        (!item.actionPayload?.facultyId || item.actionPayload.facultyId === faculty?.id)),
    };
  }
  if (roleCode !== 'STUDENT' && roleCode !== 'CLASS_REPRESENTATIVE') return state;

  const email = user?.email?.toLowerCase();
  const student = (state.students || []).find((item: any) => item.email?.toLowerCase() === email);
  const sectionId = user?.profile?.sectionId || user?.profile?.crSectionId || student?.sectionId;
  if (!sectionId) return {
    ...state, departments: [], programs: [], courses: [], facultyMembers: [], rooms: [], sections: [], students: [],
    studentsCount: 0,
    allocations: [], constraints: [], sessions: [], publishedSessions: [], versions: [], notifications: [], polls: [],
    makeupTasks: [], recoveryOpportunities: [], auditLogs: [],
  };

  const sections = (state.sections || []).filter((item: any) => item.id === sectionId);
  const sessionsForSection = (sessions: any[]) => (sessions || []).filter((item: any) => item.sectionId === sectionId);
  const sectionSessions = sessionsForSection(state.sessions);
  const publishedSessions = sessionsForSection(state.publishedSessions);
  const visibleSessions = [...sectionSessions, ...publishedSessions];
  const courseIds = new Set(visibleSessions.map((item: any) => item.courseId));
  const facultyIds = new Set(visibleSessions.map((item: any) => item.facultyId));
  const roomIds = new Set(visibleSessions.map((item: any) => item.roomId));
  const courseAllocations = (state.allocations || []).filter((item: any) => item.sectionId === sectionId);
  courseAllocations.forEach((item: any) => { courseIds.add(item.courseId); facultyIds.add(item.facultyId); });
  const visibleSessionIds = new Set(visibleSessions.map((item: any) => item.id));
  const notificationVisible = (item: any) => {
    if (item.type === 'system_alert' || ['internal', 'admin_audit', 'system'].includes(item.type) || /master academic dataset persisted|internal system event|administrative event/i.test(`${item.title || ''} ${item.message || ''}`)) return false;
    if (item.userId && item.userId !== user?.id) return false;
    const linkedSection = item.actionPayload?.sectionId;
    const linkedSession = item.actionPayload?.sessionId;
    if (linkedSection) return linkedSection === sectionId;
    if (linkedSession && /cancel|class_disrupted|poll|makeup|recovery/i.test(`${item.type || ''} ${item.title || ''} ${item.action || ''}`)) return visibleSessionIds.has(linkedSession);
    if (['cancellation', 'poll_created', 'makeup_request', 'recovery'].includes(item.type)) return false;
    return true;
  };
  const scopeVersions = (versions: any[]) => (versions || []).map((version: any) => ({ ...version, sessions: sessionsForSection(version.sessions) }));
  return {
    ...state,
    departments: (state.departments || []).filter((item: any) => item.id === sections[0]?.departmentId),
    programs: (state.programs || []).filter((item: any) => item.id === sections[0]?.programId || item.departmentId === sections[0]?.departmentId),
    courses: (state.courses || []).filter((item: any) => courseIds.has(item.id)),
    facultyMembers: (state.facultyMembers || []).filter((item: any) => facultyIds.has(item.id)).map((item: any) => ({
      id: item.id, name: item.name, departmentId: item.departmentId, designation: item.designation, status: item.status,
    })),
    rooms: (state.rooms || []).filter((item: any) => roomIds.has(item.id) || item.id === sections[0]?.homeRoomId),
    sections,
    students: student ? [student] : [],
    studentsCount: sections[0]?.studentCount || 0,
    allocations: courseAllocations,
    constraints: [],
    sessions: sectionSessions,
    publishedSessions,
    versions: scopeVersions(state.versions),
    notifications: (state.notifications || []).filter(notificationVisible),
    polls: (state.polls || []).filter((item: any) => item.sectionId === sectionId),
    makeupTasks: (state.makeupTasks || []).filter((item: any) => item.sectionId === sectionId),
    recoveryOpportunities: (state.recoveryOpportunities || []).filter((item: any) => {
      const task = (state.makeupTasks || []).find((candidate: any) => candidate.id === item.makeupTaskId);
      return task?.sectionId === sectionId;
    }),
    auditLogs: [],
  };
}

// Master Bootstrap State (Database-backed read for complete academic workspace)
app.get('/api/events/stream', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const client: RealtimeClient = {
    res,
    userId: req.authenticatedUser?.id || 'anonymous',
    roleCode: (req.authenticatedUser?.roleCode || 'STUDENT') as RoleCode,
    sectionId: typeof req.authenticatedUser?.profile?.sectionId === 'string' ? req.authenticatedUser.profile.sectionId : undefined,
    department: req.authenticatedUser?.department,
  };

  res.write(`id: ${realtimeEventSeq}\ndata: ${JSON.stringify({ type: 'connected', seq: realtimeEventSeq, at: new Date().toISOString() })}\n\n`);

  // Replay authorized missed events on reconnect (Last-Event-ID header)
  const lastEventId = Number(req.header('last-event-id'));
  if (Number.isFinite(lastEventId) && lastEventId > 0) {
    for (const ev of recentRealtimeEvents) {
      if (ev.id > lastEventId && isClientAuthorizedForEvent(client, ev)) {
        res.write(`id: ${ev.id}\ndata: ${JSON.stringify({ type: 'state_changed', eventId: ev.eventId, path: ev.path, at: ev.at })}\n\n`);
      }
    }
  }

  realtimeSseClients.add(client);
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepalive);
      realtimeSseClients.delete(client);
    }
  }, 25_000);
  keepalive.unref?.();
  req.on('close', () => {
    clearInterval(keepalive);
    realtimeSseClients.delete(client);
  });
});

app.get('/api/academic/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const state = supabaseStore.getBootstrapState(req.authenticatedUser?.id);
  const sanitized = sanitizeAcademicState(state, req.authenticatedUser?.roleCode, req.authenticatedUser);
  // ETags make the client's frequent cross-portal refresh cheap when the
  // scoped academic data has not changed. Keep the cache private and vary it
  // by session cookie so one user's role projection is never reused for another.
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
  res.vary('Cookie');
  return res.json({
    success: true,
    ...sanitized,
  });
});

// Paginated Students Query Endpoint
app.get('/api/students', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const search = (req.query.search as string) || '';
  const sectionId = (req.query.sectionId as string) || '';

  let departmentId: string | undefined;
  if (req.authenticatedUser?.roleCode === 'HOD') {
    const state = supabaseStore.getBootstrapState();
    const linkedFaculty = (state.facultyMembers || []).find((faculty: any) => faculty.id === req.authenticatedUser?.profile?.facultyId || faculty.email?.toLowerCase() === req.authenticatedUser?.email.toLowerCase());
    departmentId = linkedFaculty?.departmentId || (state.departments || []).find((department: any) => department.id === req.authenticatedUser?.department || department.name === req.authenticatedUser?.department)?.id;
    if (!departmentId) return res.status(403).json({ success: false, message: 'HOD account is not linked to a department.' });
  }
  const result = supabaseStore.queryStudents(page, limit, search, sectionId, departmentId);
  return res.json({
    success: true,
    ...result,
  });
});

// 1. Departments CRUD
app.get('/api/academic/departments', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, departments: state.departments });
});

app.post('/api/academic/departments', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { name, code, hodName, contactEmail, status } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Department name and code are required.' });
  }
  try {
    const dept = supabaseStore.createDepartment(
      {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        hodName: hodName || 'Head of Department',
        contactEmail: contactEmail || `hod.${String(code).toLowerCase()}@thapar.edu`,
        status: status || 'Active',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({ success: true, message: `Department '${dept.name}' created.`, department: dept });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/departments/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const deptId = req.params.id as string;
    const dept = supabaseStore.updateDepartment(deptId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, department: dept });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/departments/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const deptId = req.params.id as string;
    supabaseStore.deleteDepartment(deptId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Department deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Programs CRUD
app.get('/api/academic/programs', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, programs: state.programs });
});

app.post('/api/academic/programs', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { name, code, departmentId, durationYears, totalSemesters, status } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Program name and code are required.' });
  }
  try {
    const prog = supabaseStore.createProgram(
      {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        departmentId: departmentId || 'dept-cse',
        durationYears: Number(durationYears) || 4,
        totalSemesters: Number(totalSemesters) || 8,
        status: status || 'Active',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({ success: true, message: `Program '${prog.name}' created.`, program: prog });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/programs/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const progId = req.params.id as string;
    const prog = supabaseStore.updateProgram(progId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, program: prog });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/programs/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const progId = req.params.id as string;
    supabaseStore.deleteProgram(progId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Program deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 3. Courses CRUD
app.get('/api/academic/courses', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, courses: state.courses });
});

app.post('/api/academic/courses', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const {
    code,
    name,
    title,
    credits,
    departmentId,
    requiredLecturesPerWeek,
    requiredTutorialsPerWeek,
    requiredLabsPerWeek,
    requiresLab,
    requiredEquipment,
    primaryFacultyId,
  } = req.body;
  const courseCode = String(code || '').trim().toUpperCase();
  const courseName = String(name || title || '').trim();

  if (!courseCode || !courseName) {
    return res.status(400).json({ success: false, message: 'Course code and course title are required.' });
  }

  try {
    const course = supabaseStore.createCourse(
      {
        code: courseCode,
        name: courseName,
        departmentId: departmentId || 'dept-cse',
        credits: Number(credits) || 4,
        requiredLecturesPerWeek: Number(requiredLecturesPerWeek) || 3,
        requiredTutorialsPerWeek: Number(requiredTutorialsPerWeek) || 0,
        requiredLabsPerWeek: Number(requiredLabsPerWeek) || 0,
        totalSemesterHours: 45,
        completedHours: 0,
        cancelledHours: 0,
        requiresLab: Boolean(requiresLab || (Number(requiredLabsPerWeek) || 0) > 0),
        requiredEquipment: Array.isArray(requiredEquipment) ? requiredEquipment : ['Projector'],
        primaryFacultyId: primaryFacultyId || 'fac-sharma',
        status: 'Active',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({
      success: true,
      message: `Course '${course.code} - ${course.name}' added to curriculum catalog.`,
      courseId: course.id,
      course,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/courses/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseId = req.params.id as string;
    const course = supabaseStore.updateCourse(courseId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, course });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/courses/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseId = req.params.id as string;
    supabaseStore.deleteCourse(courseId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 4. Faculty CRUD
app.get('/api/academic/faculty', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, facultyMembers: state.facultyMembers });
});

app.post('/api/academic/faculty', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { name, email, departmentId, designation, subjectsQualified, maxDirectTeachingHours, preferences } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Faculty name and institutional email are required.' });
  }
  try {
    const faculty = supabaseStore.createFaculty(
      {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        departmentId: departmentId || 'dept-cse',
        designation: designation || 'Assistant Professor',
        subjectsQualified: Array.isArray(subjectsQualified) ? subjectsQualified : ['CS501'],
        maxDirectTeachingHours: designation === 'Assistant Professor' ? 16 : designation === 'Visiting Faculty' ? (Number(maxDirectTeachingHours) || 14) : 14,
        weeklyHoursLimit: 40,
        preferences: preferences || {
          preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          preferredPeriods: [1, 2, 3, 4],
          protectedSlots: [],
          maxConsecutivePeriods: 2,
          availableForMakeup: true,
          availableForTutorial: true,
        },
        status: 'Active',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({ success: true, message: `Faculty '${faculty.name}' registered.`, faculty });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/faculty/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const facultyId = req.params.id as string;
    const faculty = supabaseStore.updateFaculty(facultyId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, faculty });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/faculty/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const facultyId = req.params.id as string;
    supabaseStore.deleteFaculty(facultyId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Faculty removed successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 5. Rooms CRUD
app.get('/api/academic/rooms', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, rooms: state.rooms });
});

app.post('/api/academic/rooms', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { name, capacity, building, floor, type, equipment } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ success: false, message: 'Room name and capacity are required.' });
  }
  try {
    const room = supabaseStore.createRoom(
      {
        name: String(name).trim(),
        building: building || 'Turing Block',
        floor: Number(floor) || 1,
        capacity: Number(capacity),
        type: type || 'LectureHall',
        equipment: Array.isArray(equipment) ? equipment : ['Projector', 'Whiteboard'],
        isAvailable: true,
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({
      success: true,
      message: `Room '${room.name}' registered with capacity ${room.capacity}.`,
      roomId: room.id,
      room,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/rooms/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomId = req.params.id as string;
    const room = supabaseStore.updateRoom(roomId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, room });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/rooms/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomId = req.params.id as string;
    supabaseStore.deleteRoom(roomId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Groups & Subgroups (Cohorts) CRUD
app.get('/api/academic/groups', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, sections: state.sections });
});

app.post('/api/academic/groups', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { name, departmentId, program, semester, batchYear, studentCount, targetSize, maxSize, classRepresentative, subSections } = req.body;
  if (!name || !studentCount) {
    return res.status(400).json({ success: false, message: 'Group name and student count are required.' });
  }
  try {
    const group = supabaseStore.createGroup(
      {
        name: String(name).trim(),
        departmentId: departmentId || 'dept-cse',
        program: program || 'B.Tech Computer Science & Engineering',
        semester: Number(semester) || 5,
        batchYear: Number(batchYear) || 2024,
        studentCount: Number(studentCount),
        targetSize: Number(targetSize) || Number(studentCount),
        maxSize: Number(maxSize) || Math.ceil(Number(studentCount) * 1.2),
        subSections: Array.isArray(subSections) ? subSections : undefined,
        classRepresentative: classRepresentative || {
          name: 'Section Representative',
          email: `cr.${String(name).toLowerCase()}@thapar.edu`,
          studentId: '102303001',
        },
        status: 'Active',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({ success: true, message: `Cohort '${group.name}' registered.`, section: group });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/groups/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = req.params.id as string;
    const group = supabaseStore.updateGroup(groupId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, section: group });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/groups/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = req.params.id as string;
    supabaseStore.deleteGroup(groupId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Cohort removed successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Bulk Cohort Generation
app.post('/api/academic/groups/bulk', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { programName, batchYear, totalStudents, numGroups, namingPattern, numSubgroupsPerGroup, departmentId } = req.body;
  if (!totalStudents || !numGroups) {
    return res.status(400).json({ success: false, message: 'Total students and number of groups are required.' });
  }
  try {
    const groups = supabaseStore.bulkGenerateGroups(
      {
        programName: programName || 'B.Tech Computer Science & Engineering',
        batchYear: Number(batchYear) || 2024,
        totalStudents: Number(totalStudents),
        numGroups: Number(numGroups),
        namingPattern: namingPattern || 'CSE-{A}',
        numSubgroupsPerGroup: Number(numSubgroupsPerGroup) || 2,
        departmentId,
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({ success: true, message: `Generated ${groups.length} cohorts with subgroups.`, sections: groups });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Subgroup Add & Delete
app.post('/api/academic/subgroups', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { groupId, name, studentCount, type } = req.body;
  if (!groupId || !name) {
    return res.status(400).json({ success: false, message: 'Group ID and subgroup name are required.' });
  }
  try {
    const sub = supabaseStore.addSubgroup(groupId, name, Number(studentCount) || undefined, type || 'Lab', req.authenticatedUser?.name);
    return res.status(201).json({ success: true, subgroup: sub });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/subgroups/:groupId/:subgroupId', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = req.params.groupId as string;
    const subgroupId = req.params.subgroupId as string;
    supabaseStore.deleteSubgroup(groupId, subgroupId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Subgroup removed successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 7. Course Allocations CRUD
app.get('/api/academic/allocations', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, allocations: state.allocations });
});

app.post('/api/academic/allocations', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { courseId, facultyId, sectionId, subSectionId, sessionType, hoursPerWeek, preferredRoomId } = req.body;
  if (!courseId || !facultyId || !sectionId) {
    return res.status(400).json({ success: false, message: 'Course ID, Faculty ID, and Section ID are required.' });
  }
  try {
    const alloc = supabaseStore.createAllocation(
      {
        courseId,
        facultyId,
        sectionId,
        subSectionId,
        sessionType: sessionType || 'Lecture',
        hoursPerWeek: Number(hoursPerWeek) || 3,
        preferredRoomId,
        status: 'Allocated',
      },
      req.authenticatedUser?.name
    );
    return res.status(201).json({
      success: true,
      message: 'Course-Faculty allocation created successfully.',
      allocationId: alloc.id,
      allocation: alloc,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/academic/allocations/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocId = req.params.id as string;
    const alloc = supabaseStore.updateAllocation(allocId, req.body, req.authenticatedUser?.name);
    return res.json({ success: true, allocation: alloc });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/academic/allocations/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocId = req.params.id as string;
    supabaseStore.deleteAllocation(allocId, req.authenticatedUser?.name);
    return res.json({ success: true, message: 'Allocation deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 8. Transactional Master Excel Import
app.post('/api/academic/import', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { parsedData, mode = 'upsert' } = req.body;
  if (!parsedData) {
    return res.status(400).json({ success: false, message: 'Parsed workbook payload is required.' });
  }
  try {
    const result = supabaseStore.commitMasterExcelImport(parsedData, mode, req.authenticatedUser?.name);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Database import error: ${err.message}` });
  }
});

// -------------------------------------------------------------
// TIMETABLE SCHEDULING, SOLVER & VERSIONING APIS
// -------------------------------------------------------------

// Timetable Generation (Server-Side Solver + Independent Validator + Supabase Persistence)
const handleGenerateTimetable = (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};
  const { budgetMode = 'BALANCED', timeBudgetMs = 800, routines, async: isAsync } = body;

  if (isAsync) {
    const state = supabaseStore.getAcademicState();

    const jobId = timetableJobManager.createJob(
      state.academicYear,
      state.allocations,
      state.facultyMembers,
      state.rooms,
      state.sections,
      state.courses,
      state.constraints,
      { budgetMode, timeBudgetMs: Number(timeBudgetMs) }
    );

    return res.status(202).json({
      jobId,
      status: 'PENDING',
      message: 'Timetable generation job initiated in background.',
    });
  }

  const result = supabaseStore.generateDualRoutines(
    {
      budgetMode,
      timeBudgetMs: Number(timeBudgetMs),
      routines: Array.isArray(routines) ? routines : undefined,
    },
    req.authenticatedUser?.name
  );

  const jobId = `job_sync_${crypto.randomUUID()}`;

  return res.json({
    jobId,
    ...result,
    generatedBy: req.authenticatedUser?.name,
  });
};

app.post('/api/academic/generate', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handleGenerateTimetable);
app.post('/api/timetable/generate', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handleGenerateTimetable);
app.post('/api/timetables/generate', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handleGenerateTimetable);
app.post('/api/timetable/generate-engine', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handleGenerateTimetable);

// Job API Endpoints
app.post('/api/timetable/jobs', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};
  const allowedBudgets = new Set(['FAST', 'BALANCED', 'MAXIMUM_OPTIMIZATION']);
  const allowedProfiles = new Set(['STUDENT_FOCUSED', 'FACULTY_FOCUSED', 'BALANCED']);
  const budgetMode = allowedBudgets.has(body.budgetMode) ? body.budgetMode : 'BALANCED';
  const optimizationProfile = allowedProfiles.has(body.optimizationProfile) ? body.optimizationProfile : 'BALANCED';
  const parsedBudget = Number(body.timeBudgetMs);
  const timeBudgetMs = Number.isFinite(parsedBudget) ? Math.min(60_000, Math.max(100, parsedBudget)) : 800;
  const seed = body.seed !== undefined && Number.isFinite(Number(body.seed)) ? Number(body.seed) : undefined;

  const state = supabaseStore.getAcademicState();

  const jobId = timetableJobManager.createJob(
    state.academicYear,
    state.allocations,
    state.facultyMembers,
    state.rooms,
    state.sections,
    state.courses,
    state.constraints,
    { budgetMode, timeBudgetMs, optimizationProfile, seed }
  );

  return res.status(202).json({
    jobId,
    status: 'PENDING',
    progress: 0,
    message: 'Generation job enqueued successfully.',
  });
});

app.get('/api/timetable/jobs/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: Request, res: Response) => {
  const jobId = req.params.id as string;
  const job = timetableJobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: `Job ${jobId} not found.` });
  }
  return res.json(job);
});

app.post('/api/timetable/jobs/:id/apply', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const job = timetableJobManager.getJob(req.params.id as string);
  if (!job) return res.status(404).json({ success: false, message: 'Generation job was not found.' });
  if (job.status !== 'COMPLETED' || !job.result?.bestCandidate) {
    return res.status(409).json({ success: false, message: job.error || 'Generation has not produced an applicable result.' });
  }
  const version = supabaseStore.applyGeneratedCandidate(job.result.bestCandidate, req.authenticatedUser?.name);
  if (!version) return res.status(422).json({ success: false, message: 'Generated result failed independent validation and was not applied.' });
  return res.json({ success: true, version, message: `Generated ${version.versionLabel} and saved it as the working draft.` });
});

app.post('/api/timetable/jobs/:id/cancel', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: Request, res: Response) => {
  const jobId = req.params.id as string;
  const success = timetableJobManager.cancelJob(jobId);
  if (!success) {
    return res.status(400).json({ success: false, message: `Job ${jobId} could not be cancelled or has already completed.` });
  }
  return res.json({ success: true, message: `Job ${jobId} has been cancelled.` });
});

// Select Routine Version as Active Draft
app.post('/api/timetable/select-routine', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { versionNumber } = req.body;
  if (!versionNumber) {
    return res.status(400).json({ success: false, message: 'Version number is required.' });
  }

  const result = supabaseStore.selectRoutineVersion(Number(versionNumber), req.authenticatedUser?.name);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({
    success: true,
    message: result.message,
    version: result.version,
  });
});

// Controlled manual class creation with authoritative server-side conflict checks.
app.post('/api/timetable/sessions', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { courseId, facultyId, roomId, sectionId, day, timeSlotId, type, subSectionId } = req.body || {};
  if (![courseId, facultyId, roomId, sectionId, day, timeSlotId, type].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ success: false, message: 'Course, faculty, room, section, day, time slot, and class type are required.' });
  }
  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(day)) {
    return res.status(400).json({ success: false, message: 'Invalid class day.' });
  }
  const result = supabaseStore.addClassSession({
    courseId, facultyId, roomId, sectionId, day, timeSlotId, type,
    ...(typeof subSectionId === 'string' ? { subSectionId } : {}),
    status: 'Confirmed',
  }, req.authenticatedUser?.name);
  if (!result.success) return res.status(422).json({ success: false, message: result.error });
  return res.status(201).json({ success: true, session: result.session });
});

app.delete('/api/timetable/sessions/:id', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const deleted = supabaseStore.deleteClassSession(req.params.id as string, req.authenticatedUser?.name);
  if (!deleted) return res.status(404).json({ success: false, message: 'Session not found.' });
  return res.json({ success: true, message: 'Session removed from the working draft.' });
});

app.put('/api/timetable/sessions/:id/lock', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const isLocked = req.body?.isLocked;
  if (typeof isLocked !== 'boolean') return res.status(400).json({ success: false, message: 'isLocked must be a boolean.' });
  const reason = String(req.body?.reason || 'Coordinator lock').slice(0, 240);
  const session = supabaseStore.setSessionLock(req.params.id as string, isLocked, reason, req.authenticatedUser?.name);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  return res.json({ success: true, session });
});

// Controlled Manual Move with Independent Validation
app.post('/api/timetable/move', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, targetDay, targetTimeSlotId, targetRoomId, reason } = req.body;
  if (!sessionId || !targetDay || !targetTimeSlotId || !targetRoomId) {
    return res.status(400).json({ success: false, message: 'Session ID, target day, time slot, and room ID are required.' });
  }

  const result = supabaseStore.moveSessionWithValidation(
    sessionId,
    targetDay,
    targetTimeSlotId,
    targetRoomId,
    reason || 'Manual Coordinator Adjustment',
    req.authenticatedUser?.name
  );

  if (!result.success) {
    return res.status(422).json({ success: false, error: result.error, message: result.error });
  }

  return res.json({
    success: true,
    message: 'Session moved successfully and draft version saved.',
    version: result.updatedVersion,
  });
});

// Controlled Manual Swap with Independent Validation
app.post('/api/timetable/swap', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const { sessionAId, sessionBId, reason } = req.body;
  if (!sessionAId || !sessionBId) {
    return res.status(400).json({ success: false, message: 'Session A ID and Session B ID are required for swapping.' });
  }

  const result = supabaseStore.swapSessionsWithValidation(
    sessionAId,
    sessionBId,
    reason || 'Manual Coordinator Swap',
    req.authenticatedUser?.name
  );

  if (!result.success) {
    return res.status(422).json({ success: false, error: result.error, message: result.error });
  }

  return res.json({
    success: true,
    message: 'Sessions swapped successfully and draft version saved.',
    version: result.updatedVersion,
  });
});

// Final timetable approval remains an Admin responsibility.
app.post('/api/timetable/approve', requireAuth, requireRole(['COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { versionId } = req.body;
  supabaseStore.approveTimetable(versionId || 'V1.0', req.authenticatedUser?.name);
  return res.json({
    success: true,
    message: `Timetable version ${versionId || 'V1.0'} has been officially approved by Academic Dean.`,
    approvedBy: req.authenticatedUser?.name,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/timetable/department-approval', requireAuth, requireRole(['HOD']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.authenticatedUser;
  const facultyId = typeof user?.profile?.facultyId === 'string' ? user.profile.facultyId : undefined;
  const faculty = supabaseStore.getBootstrapState().facultyMembers.find((item: any) => item.id === facultyId);
  if (!faculty) return res.status(403).json({ success: false, message: 'HOD account is not linked to a department record.' });
  const result = supabaseStore.recordDepartmentApproval(faculty.departmentId, req.body?.versionId || 'V1.0', user?.name);
  return res.json({ success: true, message: 'Department sign-off recorded.', departmentId: faculty.departmentId, timestamp: result.timestamp });
});

// Timetable Publish (College Admin / Dean only)
const handlePublishTimetable = (req: AuthenticatedRequest, res: Response) => {
  const { versionId } = req.body;
  const validation = supabaseStore.validateCurrentTimetable();
  if (!validation.canPublish) {
    return res.status(422).json({
      success: false,
      message: `Cannot publish: ${validation.hardViolationsCount} hard conflicts and ${Math.max(0, validation.requiredSessionsCount - validation.scheduledSessionsCount)} unscheduled hours.`,
    });
  }
  supabaseStore.publishTimetable(versionId || 'V1.0', req.authenticatedUser?.name);
  return res.json({
    success: true,
    message: `Timetable version ${versionId || 'V1.0'} is now officially published for institutional access.`,
    publishedBy: req.authenticatedUser?.name,
    timestamp: new Date().toISOString(),
  });
};

app.post('/api/timetable/publish', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handlePublishTimetable);
app.post('/api/timetables/publish', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), handlePublishTimetable);
app.post('/api/timetable/unpublish', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  supabaseStore.unpublishTimetable(req.authenticatedUser?.name);
  return res.json({ success: true, message: 'Timetable returned to draft mode.' });
});

// Timetable Versions List & Restore
app.get('/api/timetable/versions', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = sanitizeAcademicState(supabaseStore.getBootstrapState(), req.authenticatedUser?.roleCode, req.authenticatedUser);
  return res.json({ success: true, versions: state.versions });
});

app.post('/api/timetable/versions/:versionNumber/restore', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const verNum = Number(req.params.versionNumber);
  const restored = supabaseStore.restoreVersion(verNum, req.authenticatedUser?.name);
  if (!restored) {
    return res.status(404).json({ success: false, message: `Version ${verNum} not found.` });
  }
  return res.json({ success: true, message: `Restored timetable to ${restored.versionLabel}`, version: restored });
});

// Timetable Benchmark Endpoint
app.get('/api/timetable/benchmark', requireAuth, requireRole(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COORDINATOR']), (req: AuthenticatedRequest, res: Response) => {
  const rl = checkRateLimit(`benchmark:${req.authenticatedUser?.id || req.ip}`, 2, 60_000);
  if (rl.limited) {
    return res.status(429).setHeader('Retry-After', String(rl.retryAfterSec ?? 60)).json({ success: false, message: 'Too many benchmark requests. Max 2 per minute.' });
  }
  const resultFast = executeOptimizationEngine(
    INITIAL_ACADEMIC_YEAR,
    INITIAL_ALLOCATIONS,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    COURSES,
    INITIAL_CONSTRAINTS,
    { budgetMode: 'FAST', timeBudgetMs: 200, seed: 101, maxCandidates: 1 }
  );

  const resultOpt = executeOptimizationEngine(
    INITIAL_ACADEMIC_YEAR,
    INITIAL_ALLOCATIONS,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    COURSES,
    INITIAL_CONSTRAINTS,
    { budgetMode: 'MAXIMUM_OPTIMIZATION', timeBudgetMs: 500, seed: 101, maxCandidates: 3 }
  );

  return res.json({
    engineVersion: '2.0.0-BitsetMRV',
    fastMode: {
      isFeasible: resultFast.isFeasible,
      totalTimeMs: resultFast.metrics.totalTimeMs,
      candidatesEvaluated: resultFast.metrics.candidatesEvaluated,
      candidatesPruned: resultFast.metrics.candidatesPruned,
      healthScore: resultFast.bestCandidate?.healthScore || 0,
    },
    optimizationMode: {
      isFeasible: resultOpt.isFeasible,
      totalTimeMs: resultOpt.metrics.totalTimeMs,
      candidatesEvaluated: resultOpt.metrics.candidatesEvaluated,
      candidatesPruned: resultOpt.metrics.candidatesPruned,
      healthScore: resultOpt.bestCandidate?.healthScore || 0,
      candidatesCount: resultOpt.allCandidates.length,
    },
  });
});

// -------------------------------------------------------------
// RECOVERY, NOTIFICATIONS & REPLACEMENT VOTING APIS
// -------------------------------------------------------------

// Cancel Class (Faculty, Coordinator, Admin)
app.post('/api/recovery/cancel-class', requireAuth, requireRole(['FACULTY', 'COORDINATOR', 'COLLEGE_ADMIN', 'HOD', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, reason } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Session ID is required.' });
  }

  const user = req.authenticatedUser;
  const state = supabaseStore.getBootstrapState();
  const session = (state.sessions || []).find((s: any) => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  if (user?.roleCode === 'FACULTY') {
    const faculty = (state.facultyMembers || []).find((f: any) => f.email.toLowerCase() === user.email.toLowerCase() || f.id === (user as any).facultyId);
    if (!faculty || session.facultyId !== faculty.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Faculty can only cancel classes they teach.' });
    }
  } else if (user?.roleCode === 'HOD') {
    const faculty = (state.facultyMembers || []).find((f: any) => f.id === session.facultyId);
    const linkedFacultyId = typeof user.profile?.facultyId === 'string' ? user.profile.facultyId : undefined;
    const linkedHodFaculty = (state.facultyMembers || []).find((f: any) => f.id === linkedFacultyId);
    if (!faculty || !linkedHodFaculty || faculty.departmentId !== linkedHodFaculty.departmentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: HOD can only cancel classes within their department.' });
    }
  }

  const result = supabaseStore.cancelClassSession(sessionId, reason || 'Unforeseen conflict', user?.name);
  if (!result.success) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }
  return res.json({
    success: true,
    message: `Class session ${sessionId} was cancelled and makeup options are being prepared.`,
    task: result.task,
    cancelledBy: req.authenticatedUser?.name,
  });
});

app.post('/api/recovery/undo-cancel', requireAuth, requireRole(['FACULTY', 'COORDINATOR', 'COLLEGE_ADMIN', 'HOD', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const sessionId = String(req.body?.sessionId || '');
  const user = req.authenticatedUser;
  const state = supabaseStore.getBootstrapState();
  const session = (state.sessions || []).find((item: any) => item.id === sessionId && item.status === 'Cancelled');
  if (!session) return res.status(404).json({ success: false, message: 'Cancelled class was not found.' });
  if (user?.roleCode === 'FACULTY') {
    const faculty = (state.facultyMembers || []).find((item: any) => item.email?.toLowerCase() === user.email.toLowerCase() || item.id === user.profile?.facultyId);
    if (!faculty || session.facultyId !== faculty.id) return res.status(403).json({ success: false, message: 'Faculty may only undo cancellations for their own classes.' });
  }
  const success = supabaseStore.undoClassCancellation(sessionId, user?.name);
  return success ? res.json({ success: true }) : res.status(409).json({ success: false, message: 'Cancellation could not be reversed.' });
});

app.post('/api/recovery/request-change', requireAuth, requireRole(['FACULTY', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const sessionId = String(req.body?.sessionId || '');
  const details = String(req.body?.details || '').trim();
  if (!sessionId || details.length < 5 || details.length > 500) {
    return res.status(400).json({ success: false, message: 'Choose a class and provide a request of 5–500 characters.' });
  }
  const state = supabaseStore.getBootstrapState();
  const session = state.sessions.find((item: any) => item.id === sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Class session not found.' });
  const user = req.authenticatedUser;
  const linkedFaculty = state.facultyMembers.find((faculty: any) => faculty.email.toLowerCase() === user?.email.toLowerCase() || faculty.id === user?.profile?.facultyId);
  if (user?.roleCode === 'FACULTY' && (!linkedFaculty || session.facultyId !== linkedFaculty.id)) {
    return res.status(403).json({ success: false, message: 'Faculty may only request changes for classes they teach.' });
  }
  if (user?.roleCode === 'HOD') {
    const sessionFaculty = state.facultyMembers.find((faculty: any) => faculty.id === session.facultyId);
    if (!linkedFaculty || !sessionFaculty || linkedFaculty.departmentId !== sessionFaculty.departmentId) {
      return res.status(403).json({ success: false, message: 'HODs may only request changes within their department.' });
    }
  }
  if (!supabaseStore.requestScheduleChange(sessionId, details, user?.name)) return res.status(404).json({ success: false, message: 'Class session not found.' });
  return res.json({ success: true });
});

// Schedule Makeup Session (Validates target entities, pending state, and hard conflict freedom)
app.post('/api/recovery/schedule-makeup', requireAuth, requireRole(['FACULTY', 'COORDINATOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { opportunityId } = req.body;
  if (!opportunityId) {
    return res.status(400).json({ success: false, message: 'Opportunity ID is required.' });
  }

  const state = supabaseStore.getBootstrapState();
  const opp = (state.recoveryOpportunities || []).find((o: any) => o.id === opportunityId);
  if (!opp) {
    return res.status(404).json({ success: false, message: 'Recovery opportunity not found.' });
  }

  // Verify opportunity is in PENDING/Proposed state
  const statusUpper = String(opp.status || '').toUpperCase();
  if (statusUpper !== 'PROPOSED' && statusUpper !== 'PENDING') {
    return res.status(400).json({
      success: false,
      message: `Recovery opportunity is already ${opp.status}. Only PENDING or Proposed opportunities can be scheduled.`,
    });
  }

  // Verify referenced cancellation task exists
  const makeupTask = (state.makeupTasks || []).find((t: any) => t.id === opp.makeupTaskId);
  if (!makeupTask) {
    return res.status(400).json({ success: false, message: 'Referenced cancellation task not found.' });
  }

  // Validate target room, faculty, time slot, and date/day are present
  const roomId = req.body.roomId || opp.roomId;
  const facultyId = req.body.facultyId || opp.facultyId;
  const timeSlotId = req.body.timeSlotId || opp.timeSlotId;
  const targetDay = req.body.targetDay || req.body.date || opp.targetDay;

  if (!roomId || !facultyId || !timeSlotId || !targetDay) {
    return res.status(400).json({
      success: false,
      message: 'Target room, faculty, time slot, and date are required to schedule makeup session.',
    });
  }

  // Verify no conflicts in schedule before creating the makeup class
  const activeSessions = (state.sessions || []).filter((s: any) => s.status !== 'Cancelled');

  const facultyConflict = activeSessions.find(
    (s: any) => s.facultyId === facultyId && s.day === targetDay && s.timeSlotId === timeSlotId
  );
  if (facultyConflict) {
    return res.status(409).json({
      success: false,
      message: `Faculty collision: Faculty member is already scheduled for session ${facultyConflict.id} at ${targetDay} ${timeSlotId}.`,
    });
  }

  const roomConflict = activeSessions.find(
    (s: any) => s.roomId === roomId && s.day === targetDay && s.timeSlotId === timeSlotId
  );
  if (roomConflict) {
    return res.status(409).json({
      success: false,
      message: `Room collision: Room ${roomId} is already occupied by session ${roomConflict.id} at ${targetDay} ${timeSlotId}.`,
    });
  }

  const sectionConflict = activeSessions.find(
    (s: any) => s.sectionId === makeupTask.sectionId && s.day === targetDay && s.timeSlotId === timeSlotId
  );
  if (sectionConflict) {
    return res.status(409).json({
      success: false,
      message: `Section collision: Student section ${makeupTask.sectionId} is already in session ${sectionConflict.id} at ${targetDay} ${timeSlotId}.`,
    });
  }

  const result = supabaseStore.scheduleMakeupSession(opportunityId, req.authenticatedUser?.name);
  if (!result.success) {
    return res.status(400).json({ success: false, message: 'Unable to schedule recovery makeup slot.' });
  }
  return res.json({ success: true, message: 'Makeup session scheduled successfully.', session: result.session });
});

// Decline Opportunity
app.post('/api/recovery/decline', requireAuth, requireRole(['FACULTY', 'COORDINATOR', 'COLLEGE_ADMIN', 'HOD', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { opportunityId } = req.body || {};
  if (typeof opportunityId !== 'string' || !opportunityId.trim()) {
    return res.status(400).json({ success: false, message: 'A valid opportunityId is required.' });
  }
  supabaseStore.declineOpportunity(opportunityId.trim(), req.authenticatedUser?.name);
  return res.json({ success: true, message: 'Opportunity marked declined.' });
});

// Replacement Poll Voting (Enforces 1-vote constraint per student)
app.post('/api/voting/polls', requireAuth, requireRole(['CLASS_REPRESENTATIVE', 'FACULTY', 'COORDINATOR', 'HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { sectionId, courseId = '', question, options } = req.body || {};
  const state = supabaseStore.getBootstrapState();
  if (typeof sectionId !== 'string' || !state.sections.some((section: any) => section.id === sectionId)) {
    return res.status(400).json({ success: false, message: 'A valid section is required.' });
  }
  if (req.authenticatedUser?.roleCode === 'CLASS_REPRESENTATIVE' && req.authenticatedUser.profile?.sectionId !== sectionId) {
    return res.status(403).json({ success: false, message: 'Class Representatives can only poll their own section.' });
  }
  const linkedFacultyId = typeof req.authenticatedUser?.profile?.facultyId === 'string'
    ? req.authenticatedUser.profile.facultyId
    : state.facultyMembers.find((faculty: any) => faculty.email.toLowerCase() === req.authenticatedUser?.email.toLowerCase())?.id;
  if (req.authenticatedUser?.roleCode === 'FACULTY' && !state.sessions.some((session: any) => session.facultyId === linkedFacultyId && session.sectionId === sectionId && (!courseId || session.courseId === courseId))) {
    return res.status(403).json({ success: false, message: 'Faculty may only create polls for a course and section they teach.' });
  }
  if (req.authenticatedUser?.roleCode === 'HOD') {
    const linkedFaculty = state.facultyMembers.find((faculty: any) => faculty.id === linkedFacultyId);
    const section = state.sections.find((item: any) => item.id === sectionId);
    if (!linkedFaculty || section?.departmentId !== linkedFaculty.departmentId) {
      return res.status(403).json({ success: false, message: 'HODs may only create polls for their department.' });
    }
  }
  if (courseId && !state.courses.some((course: any) => course.id === courseId)) {
    return res.status(400).json({ success: false, message: 'The selected course was not found.' });
  }
  if (courseId && !state.allocations.some((allocation: any) => allocation.sectionId === sectionId && allocation.courseId === courseId)) {
    return res.status(400).json({ success: false, message: 'The selected course is not assigned to this section.' });
  }
  if (typeof question !== 'string' || question.trim().length < 5 || question.trim().length > 240) {
    return res.status(400).json({ success: false, message: 'Question must be between 5 and 240 characters.' });
  }
  const validDays = new Set(supabaseStore.getBootstrapState().academicYear.workingDays);
  if (!Array.isArray(options) || options.length < 2 || options.length > 6 || options.some((option: any) => !validDays.has(option?.day) || typeof option?.timeSlotLabel !== 'string' || !option.timeSlotLabel.trim())) {
    return res.status(400).json({ success: false, message: 'Provide 2 to 6 options with a valid day and time.' });
  }
  const labels = options.map((option: any) => `${option.day}|${option.timeSlotLabel.trim().toLowerCase()}`);
  if (new Set(labels).size !== labels.length) return res.status(400).json({ success: false, message: 'Poll options must be unique.' });
  const poll = supabaseStore.createReplacementPoll({ sectionId, courseId, question: question.trim(), options }, req.authenticatedUser?.name);
  return res.status(201).json({ success: true, poll });
});

app.post('/api/voting/polls/:id/close', requireAuth, requireRole(['CLASS_REPRESENTATIVE', 'FACULTY', 'COORDINATOR', 'HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const state = supabaseStore.getBootstrapState();
  const poll = state.polls.find((item: any) => item.id === req.params.id);
  if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
  if (req.authenticatedUser?.roleCode === 'CLASS_REPRESENTATIVE' && req.authenticatedUser.profile?.sectionId !== poll.sectionId) {
    return res.status(403).json({ success: false, message: 'Class Representatives can only close polls for their own section.' });
  }
  const linkedFacultyId = typeof req.authenticatedUser?.profile?.facultyId === 'string'
    ? req.authenticatedUser.profile.facultyId
    : state.facultyMembers.find((faculty: any) => faculty.email.toLowerCase() === req.authenticatedUser?.email.toLowerCase())?.id;
  if (req.authenticatedUser?.roleCode === 'FACULTY' && !state.sessions.some((session: any) => session.facultyId === linkedFacultyId && session.sectionId === poll.sectionId && (!poll.courseId || session.courseId === poll.courseId))) {
    return res.status(403).json({ success: false, message: 'Faculty may only close polls for a course and section they teach.' });
  }
  if (req.authenticatedUser?.roleCode === 'HOD') {
    const linkedFaculty = state.facultyMembers.find((faculty: any) => faculty.id === linkedFacultyId);
    const section = state.sections.find((item: any) => item.id === poll.sectionId);
    if (!linkedFaculty || section?.departmentId !== linkedFaculty.departmentId) {
      return res.status(403).json({ success: false, message: 'HODs may only close polls for their department.' });
    }
  }
  if (!supabaseStore.closeReplacementPoll(poll.id, req.authenticatedUser?.name)) {
    return res.status(409).json({ success: false, message: 'Poll is already closed.' });
  }
  return res.json({ success: true });
});

app.post('/api/voting/polls/:id/apply', requireAuth, requireRole(['FACULTY', 'COORDINATOR', 'HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const result = supabaseStore.applyWinningPollOption(String(req.params.id), req.authenticatedUser?.name);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ success: false, message: result.message });
  }
  return res.json(result);
});

app.post('/api/voting/vote', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { pollId, optionId } = req.body;
  const studentId = req.authenticatedUser?.id || req.authenticatedUser?.email || 'student';

  if (!pollId || !optionId) {
    return res.status(400).json({ success: false, message: 'Poll ID and option ID are required.' });
  }

  if (!['STUDENT', 'CLASS_REPRESENTATIVE'].includes(req.authenticatedUser?.roleCode || '')) {
    return res.status(403).json({ success: false, message: 'Only students and class representatives may vote.' });
  }
  const state = supabaseStore.getBootstrapState();
  const poll = state.polls.find((item: any) => item.id === pollId);
  if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
  if (req.authenticatedUser?.profile?.sectionId !== poll.sectionId) {
    return res.status(403).json({ success: false, message: 'You may only vote in a poll for your linked section.' });
  }

  const result = supabaseStore.castReplacementVote(pollId, studentId, optionId);
  if (!result.success) {
    return res.status(409).json({ success: false, message: result.message });
  }
  return res.json(result);
});

// Notifications (Authenticated & Filtered by User Identity / Target Role)
app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const state = supabaseStore.getBootstrapState();
  const user = req.authenticatedUser;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const userRole = user.roleCode;
  const userDashboardRole = mapRoleCodeToDashboard(user.roleCode);
  const userId = user.id;

  const scopedNotificationIds = new Set(sanitizeAcademicState(state, userRole, user).notifications.map((n: any) => n.id));
  const filtered = state.notifications.filter((n: any) => {
    if (!scopedNotificationIds.has(n.id)) return false;
    if (['STUDENT', 'CLASS_REPRESENTATIVE'].includes(userRole) && /master academic dataset persisted/i.test(`${n.title || ''} ${n.message || ''}`)) return false;
    if (n.userId && n.userId === userId) return true;
    if (!n.recipientRole || n.recipientRole === 'ALL' || n.recipientRole === '*') return true;
    if (n.recipientRole === userRole || n.recipientRole === userDashboardRole) return true;
    if (Array.isArray(n.recipientRoles) && (n.recipientRoles.includes(userRole) || n.recipientRoles.includes(userDashboardRole))) return true;
    return false;
  });

  return res.json({ success: true, notifications: filtered });
});

app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifId = req.params.id as string;
  const success = supabaseStore.markNotificationRead(notifId);
  return res.json({ success });
});

// Redaction helpers for sensitive audit logging & telemetry
function redactSensitiveText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    // Redact bcrypt/scrypt/legacy hashes
    .replace(/\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}/g, '[REDACTED_HASH]')
    .replace(/scrypt:[a-f0-9]+:[a-f0-9]+/gi, '[REDACTED_HASH]')
    .replace(/sha256:[a-f0-9]+:[a-f0-9]+/gi, '[REDACTED_HASH]')
    // Redact JWT or hex session tokens
    .replace(/jwt_[a-zA-Z0-9_\-\.]+/g, '[REDACTED_TOKEN]')
    .replace(/sb_[a-zA-Z0-9_\-]+/g, '[REDACTED_TOKEN]')
    // Redact explicit password/secret key-value patterns in JSON or text
    .replace(/(["']?(?:password|passwd|pwd|secret|token|apiKey|authHeader)["']?\s*[:=]\s*["'])([^"'\s]+)(["'])/gi, '$1[REDACTED]$3')
    // Redact email addresses to masked format (e.g. j***@thapar.edu)
    .replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2');
}

function redactSensitiveValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return redactSensitiveText(val);
  }
  if (Array.isArray(val)) {
    return val.map(redactSensitiveValue);
  }
  if (typeof val === 'object') {
    const sanitized: Record<string, any> = {};
    const sensitiveKeyRegex = /password|secret|token|hash|key|auth|credential|session/i;
    for (const [k, v] of Object.entries(val)) {
      if (sensitiveKeyRegex.test(k)) {
        sanitized[k] = '[REDACTED]';
      } else if (k.toLowerCase().includes('email') && typeof v === 'string') {
        sanitized[k] = redactSensitiveText(v);
      } else {
        sanitized[k] = redactSensitiveValue(v);
      }
    }
    return sanitized;
  }
  return val;
}

function redactAuditLog(log: any): any {
  if (!log) return log;
  return {
    ...log,
    userId: log.userId ? (log.userId.includes('@') ? redactSensitiveText(log.userId) : log.userId) : log.userId,
    userName: log.userName ? redactSensitiveText(log.userName) : log.userName,
    details: typeof log.details === 'string' ? redactSensitiveText(log.details) : redactSensitiveValue(log.details),
    payload: log.payload ? redactSensitiveValue(log.payload) : undefined,
  };
}

// Immutable Audit Events (Redacted for Security & Privacy)
app.get('/api/audit', requireAuth, requireRole(['SUPER_ADMIN', 'COORDINATOR', 'COLLEGE_ADMIN', 'HOD']), (req: AuthenticatedRequest, res: Response) => {
  const state = supabaseStore.getBootstrapState();
  let logs = state.auditLogs || [];
  if (req.authenticatedUser?.roleCode === 'HOD') {
    const linkedFaculty = (state.facultyMembers || []).find((faculty: any) => faculty.id === req.authenticatedUser?.profile?.facultyId || faculty.email?.toLowerCase() === req.authenticatedUser?.email.toLowerCase());
    const departmentId = linkedFaculty?.departmentId || (state.departments || []).find((department: any) => department.id === req.authenticatedUser?.department || department.name === req.authenticatedUser?.department)?.id;
    if (!departmentId) return res.status(403).json({ success: false, message: 'HOD account is not linked to a department.' });
    const facultyIds = new Set((state.facultyMembers || []).filter((faculty: any) => faculty.departmentId === departmentId).map((faculty: any) => faculty.id));
    const sectionIds = new Set((state.sections || []).filter((section: any) => section.departmentId === departmentId).map((section: any) => section.id));
    const sessionIds = new Set((state.sessions || []).filter((session: any) => sectionIds.has(session.sectionId) || facultyIds.has(session.facultyId)).map((session: any) => session.id));
    const courseIds = new Set((state.courses || []).filter((course: any) => course.departmentId === departmentId).map((course: any) => course.id));
    logs = logs.filter((log: any) =>
      (log.entityType === 'DepartmentTimetable' && String(log.entityId).startsWith(`${departmentId}:`)) ||
      (log.entityType === 'ClassSession' && sessionIds.has(log.entityId)) ||
      (log.entityType === 'Faculty' && facultyIds.has(log.entityId)) ||
      (log.entityType === 'StudentSection' && sectionIds.has(log.entityId)) ||
      (log.entityType === 'Course' && courseIds.has(log.entityId))
    );
  }
  const sanitizedLogs = logs.map(redactAuditLog);
  return res.json({ success: true, auditLogs: sanitizedLogs });
});

// User administration endpoints used by Admin -> Users & Roles.
const ADMIN_ROLES: RoleCode[] = ['SUPER_ADMIN', 'COLLEGE_ADMIN'];
const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  COLLEGE_ADMIN: 'College Admin / Dean',
  COORDINATOR: 'Timetable Coordinator',
  HOD: 'Head of Department',
  FACULTY: 'Faculty Member',
  CLASS_REPRESENTATIVE: 'Class Representative',
  STUDENT: 'Student',
};
const VALID_ROLE_CODES = Object.keys(ROLE_LABELS) as RoleCode[];

function adminUserView(user: StoredUser, extra: Record<string, any> = {}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleCode: user.roleCode,
    roleName: user.roleName,
    department: user.department,
    status: user.status,
    isDemoUser: Boolean(user.isDemoUser),
    hasPassword: extra.hasPassword ?? user.passwordHash !== 'SUPABASE_AUTH_MANAGED',
    googleLinked: Boolean(extra.googleLinked),
    lastLoginAt: extra.lastLoginAt ?? null,
    profile: user.profile ?? {},
  };
}

app.get('/api/admin/pending-registrations', requireAuth, requireRole(ADMIN_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const registrations = [...pendingRegistrationsDatabase.values()]
    .filter((item) => !search || item.email.includes(search) || item.name.toLowerCase().includes(search))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => ({ id: item.id, email: item.email, name: item.name, requestedRoleCode: item.roleCode, createdAt: item.createdAt, status: 'PENDING' as const }));
  return res.json({ success: true, total: registrations.length, registrations });
});

app.post('/api/admin/pending-registrations/:email/approve', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const email = decodeURIComponent(String(req.params.email)).trim().toLowerCase();
  const pending = pendingRegistrationsDatabase.get(email);
  if (!pending) return res.status(404).json({ success: false, message: 'Pending registration not found.' });
  if (usersDatabase.has(email)) return res.status(409).json({ success: false, message: 'An account already exists for this email.' });

  const roleCode = String(req.body?.roleCode || pending.roleCode) as RoleCode;
  if (!['STUDENT', 'FACULTY', 'COORDINATOR'].includes(roleCode)) {
    return res.status(400).json({ success: false, message: 'Select a valid approved role.' });
  }
  const roleName = ROLE_LABELS[roleCode];
  const user: StoredUser = {
    id: 'usr_' + crypto.randomUUID(), name: pending.name, email, passwordHash: pending.passwordHash,
    roleId: `role-${roleCode.toLowerCase()}`, roleCode, roleName,
    institutionId: 'inst-thapar', institutionName: 'Thapar Institute of Engineering and Technology',
    department: pending.department, status: 'ACTIVE', createdAt: pending.createdAt, emailVerified: true,
    profile: { requestedRoleCode: pending.roleCode, approvedBy: req.authenticatedUser?.id },
  };

  try {
    await persistNewUserRecord(user);
  } catch (err) {
    const dbError = err as { code?: string };
    if (dbError?.code === '23505') return res.status(409).json({ success: false, message: 'An account already exists for this email.' });
    console.error('[ADMIN] Could not persist approved registration:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Approval could not be saved. Please retry.' });
  }

  usersDatabase.set(email, user);
  try {
    await Promise.all([
      persistentStore.deletePendingRegistrationDurably(email),
      persistentStore.invalidateUserTokensDurably(email),
    ]);
  } catch (err) {
    console.error('[ADMIN] Account approved but registration cleanup failed:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Account was approved, but pending registration cleanup could not be saved. Please retry.' });
  }
  return res.json({ success: true, user: adminUserView(user), message: `${email} approved as ${roleName}.` });
});

app.post('/api/admin/pending-registrations/:email/reject', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const email = decodeURIComponent(String(req.params.email)).trim().toLowerCase();
  if (!pendingRegistrationsDatabase.has(email)) return res.status(404).json({ success: false, message: 'Pending registration not found.' });
  try {
    await Promise.all([
      persistentStore.deletePendingRegistrationDurably(email),
      persistentStore.invalidateUserTokensDurably(email),
    ]);
  } catch (err) {
    console.error('[ADMIN] Could not persist registration rejection:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Registration rejection could not be saved. Please retry.' });
  }
  return res.json({ success: true, message: 'Registration request rejected.' });
});

app.get('/api/admin/users', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const byEmail = new Map<string, ReturnType<typeof adminUserView>>();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return res.status(503).json({ success: false, message: 'Could not load accounts from Supabase Auth.' });
    const authUsers = data.users || [];
    const authIds = authUsers.map((u) => u.id);
    const { data: profiles } = authIds.length
      ? await supabaseAdmin.from('profiles').select('*').in('id', authIds)
      : { data: [] as any[] };
    const profilesById = new Map((profiles || []).map((p: any) => [p.id, p]));

    for (const authUser of authUsers) {
      const email = String(authUser.email || '').toLowerCase();
      if (!email) continue;
      const profile: any = profilesById.get(authUser.id) || {};
      const seeded = usersDatabase.get(email);
      const roleCode = (profile.role_code || seeded?.roleCode || 'STUDENT') as RoleCode;
      const user: StoredUser = {
        id: authUser.id,
        email,
        name: profile.name || authUser.user_metadata?.name || seeded?.name || email.split('@')[0],
        roleCode,
        roleId: `role-${roleCode.toLowerCase()}`,
        roleName: profile.role_name || ROLE_LABELS[roleCode] || 'Student',
        institutionId: profile.institution_id || 'inst-thapar',
        institutionName: 'Thapar Institute of Engineering and Technology',
        department: profile.department || seeded?.department || '',
        status: profile.status === 'LOCKED' ? 'LOCKED' : profile.status === 'PENDING' ? 'PENDING' : 'ACTIVE',
        createdAt: authUser.created_at,
        authorizedWorkspaces: profile.authorized_workspaces || seeded?.authorizedWorkspaces,
        isDemoUser: Boolean(profile.is_demo_user || seeded?.isDemoUser),
        emailVerified: Boolean(authUser.email_confirmed_at),
        passwordHash: authUser.app_metadata?.provider === 'google' && !(authUser.app_metadata?.providers || []).includes('email')
          ? 'SUPABASE_AUTH_MANAGED'
          : 'SUPABASE_AUTH_MANAGED',
        profile: profile.profile || authUser.user_metadata?.profile || {},
      };
      byEmail.set(email, adminUserView(user, {
        googleLinked: (authUser.app_metadata?.providers || []).includes('google'),
        hasPassword: (authUser.identities || []).some((identity: any) => identity.provider === 'email'),
        lastLoginAt: authUser.last_sign_in_at,
      }));
    }
  }

  for (const user of usersDatabase.values()) {
    if (!byEmail.has(user.email.toLowerCase())) byEmail.set(user.email.toLowerCase(), adminUserView(user));
  }

  const matches = [...byEmail.values()]
    .filter((user) => !/^(Adversary User|Audit Faculty)$/i.test(user.name.trim()))
    .filter((user) => !search || user.email.toLowerCase().includes(search) || user.name.toLowerCase().includes(search))
    .sort((a, b) => Number(a.isDemoUser) - Number(b.isDemoUser) || a.roleCode.localeCompare(b.roleCode) || a.name.localeCompare(b.name));
  return res.json({ success: true, total: matches.length, page, limit, users: matches.slice((page - 1) * limit, page * limit) });
});

app.post('/api/admin/users', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const name = String(req.body?.name ?? '').trim();
  const roleCode = req.body?.roleCode as RoleCode;
  const department = String(req.body?.department ?? '').trim();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !VALID_ROLE_CODES.includes(roleCode)) {
    return res.status(400).json({ success: false, message: 'Valid email, name and role are required.' });
  }
  if (password && !evaluatePasswordPolicy(password).isValid) {
    return res.status(400).json({ success: false, message: `Password needs: ${evaluatePasswordPolicy(password).errors.join(', ')}.` });
  }
  if (usersDatabase.has(email)) return res.status(409).json({ success: false, message: 'A user with this email already exists.' });

  let id = `usr-${crypto.randomUUID()}`;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      ...(password ? { password } : {}),
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) return res.status(400).json({ success: false, message: error?.message || 'Could not create the Supabase account.' });
    id = data.user.id;
    const profile = {
      id, email, name, institution_id: 'inst-thapar', department,
      role_code: roleCode, role_name: ROLE_LABELS[roleCode],
      authorized_workspaces: resolveWorkspacesForUser({ id, name, email, roleCode, roleId: `role-${roleCode.toLowerCase()}`, roleName: ROLE_LABELS[roleCode], institutionId: 'inst-thapar', institutionName: 'Thapar Institute of Engineering and Technology', department, status: 'ACTIVE', createdAt: new Date().toISOString(), passwordHash: 'SUPABASE_AUTH_MANAGED' }),
      is_demo_user: email.endsWith('@demo.thapar.local'), status: 'ACTIVE',
    };
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profile);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      return res.status(503).json({ success: false, message: 'Account creation could not be completed because its profile was not saved.' });
    }
  }

  const user: StoredUser = {
    id, email, name, department, roleCode, roleId: `role-${roleCode.toLowerCase()}`, roleName: ROLE_LABELS[roleCode],
    institutionId: 'inst-thapar', institutionName: 'Thapar Institute of Engineering and Technology',
    status: 'ACTIVE', createdAt: new Date().toISOString(),
    passwordHash: supabaseAdmin ? 'SUPABASE_AUTH_MANAGED' : password ? hashPasswordBcryptSync(password) : 'SUPABASE_AUTH_MANAGED',
    isDemoUser: email.endsWith('@demo.thapar.local'), authorizedWorkspaces: undefined,
  };
  try {
    await persistNewUserRecord(user);
  } catch (err) {
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', id);
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch (cleanupErr) {
        console.error('[ADMIN] Supabase account cleanup failed after database write error:', cleanupErr instanceof Error ? cleanupErr.message : 'unknown error');
      }
    }
    console.error('[ADMIN] Could not persist created user:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Account could not be saved. Please retry.' });
  }
  usersDatabase.set(email, user);
  return res.status(201).json({ success: true, user: adminUserView(user) });
});

app.patch('/api/admin/users/:id', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const entry = [...usersDatabase.entries()].find(([, user]) => user.id === req.params.id);
  const user = entry?.[1];
  if (String(req.params.id) === req.authenticatedUser?.id && (req.body?.roleCode || req.body?.status)) {
    return res.status(400).json({ success: false, message: 'You cannot change your own role or lock your own account.' });
  }
  if (req.body?.roleCode !== undefined && !VALID_ROLE_CODES.includes(req.body.roleCode)) return res.status(400).json({ success: false, message: 'Unknown role.' });
  if (req.body?.status !== undefined && !['ACTIVE', 'LOCKED'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Unknown status.' });
  const targetId = String(req.params.id);
  let authUser: any = null;
  if (supabaseAdmin && !user) {
    const result = await supabaseAdmin.auth.admin.getUserById(targetId);
    authUser = result.data.user;
    if (result.error || !authUser) return res.status(404).json({ success: false, message: 'User not found.' });
  }
  if (!user && !authUser) return res.status(404).json({ success: false, message: 'User not found.' });

  const target: StoredUser = user || {
    id: targetId,
    email: String(authUser.email || '').toLowerCase(),
    name: String(authUser.user_metadata?.name || authUser.email || 'User'),
    department: '', roleCode: 'STUDENT', roleId: 'role-student', roleName: ROLE_LABELS.STUDENT,
    institutionId: 'inst-thapar', institutionName: 'Thapar Institute of Engineering and Technology',
    status: 'ACTIVE', createdAt: authUser.created_at, passwordHash: 'SUPABASE_AUTH_MANAGED',
    profile: authUser.user_metadata?.profile || {},
  };
  const nextRole = (req.body?.roleCode || target.roleCode) as RoleCode;
  const nextName = req.body?.name === undefined ? target.name : String(req.body.name).trim();
  if (!nextName) return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
  const profile = { ...(target.profile || {}), ...(req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : {}) };
  const nextStatus = (req.body?.status || target.status) as 'ACTIVE' | 'LOCKED';
  if (supabaseAdmin) {
    const authChanges: Record<string, unknown> = { user_metadata: { ...(authUser?.user_metadata || {}), name: nextName, profile } };
    if (req.body?.password) {
      if (!evaluatePasswordPolicy(String(req.body.password)).isValid) return res.status(400).json({ success: false, message: `Password needs: ${evaluatePasswordPolicy(String(req.body.password)).errors.join(', ')}.` });
      authChanges.password = String(req.body.password);
    }
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetId, authChanges as any);
    if (authError) return res.status(400).json({ success: false, message: 'Could not update the Supabase account.' });
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: targetId, email: target.email || String(authUser?.email || '').toLowerCase(), name: nextName,
      institution_id: target.institutionId, department: req.body?.department ?? target.department,
      role_code: nextRole, role_name: ROLE_LABELS[nextRole],
      authorized_workspaces: target.authorizedWorkspaces || resolveWorkspacesForUser({ ...target, roleCode: nextRole }),
      is_demo_user: Boolean(target.isDemoUser), status: nextStatus,
    });
    if (profileError) return res.status(503).json({ success: false, message: 'Could not save account role and status.' });
  }
  const updated: StoredUser = {
    ...target, name: nextName, department: req.body?.department ?? target.department, roleCode: nextRole,
    roleId: `role-${nextRole.toLowerCase()}`, roleName: ROLE_LABELS[nextRole], status: nextStatus,
    passwordHash: req.body?.password ? 'SUPABASE_AUTH_MANAGED' : target.passwordHash,
    authorizedWorkspaces: undefined, profile,
  };
  try {
    await persistUserRecord(updated);
  } catch (err) {
    console.error('[ADMIN] Could not persist updated user:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Account changes could not be saved. Please retry.' });
  }
  usersDatabase.set(updated.email.toLowerCase(), updated);
  if (req.body?.roleCode || req.body?.status === 'LOCKED' || req.body?.password) {
    try {
      await persistentStore.revokeUserSessionsDurably(targetId);
    } catch (err) {
      console.error('[ADMIN] Could not persist session revocation:', err instanceof Error ? err.message : 'unknown error');
      return res.status(503).json({ success: false, message: 'Account was updated, but existing sessions could not be fully revoked.' });
    }
  }
  return res.json({ success: true, user: adminUserView(updated) });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);
  if (targetId === req.authenticatedUser?.id) return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  const entry = [...usersDatabase.entries()].find(([, user]) => user.id === targetId);
  if (!entry && !supabaseAdmin) return res.status(404).json({ success: false, message: 'User not found.' });
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (error) return res.status(404).json({ success: false, message: 'User could not be deleted.' });
  }
  try {
    await deletePersistedUser(targetId);
  } catch (err) {
    console.error('[ADMIN] Could not persist account deletion:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Account deletion could not be fully saved. Please retry.' });
  }
  persistentStore.forgetUserSessions(targetId);
  if (entry) usersDatabase.delete(entry[0]);
  return res.json({ success: true });
});

app.post('/api/admin/users/:id/revoke-sessions', requireAuth, requireRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await persistentStore.revokeUserSessionsDurably(String(req.params.id));
  } catch (err) {
    console.error('[ADMIN] Could not persist session revocation:', err instanceof Error ? err.message : 'unknown error');
    return res.status(503).json({ success: false, message: 'Sessions could not be revoked. Please retry.' });
  }
  return res.json({ success: true });
});

app.get('/api/admin/sessions', requireAuth, requireRole(ADMIN_ROLES), (_req: AuthenticatedRequest, res: Response) => {
  const usersById = new Map([...usersDatabase.values()].map((user) => [user.id, user]));
  const grouped = new Map<string, { userId: string; name: string; email: string; roleCode: RoleCode; activeSessions: number; lastSignIn: string; expiresAt: string }>();
  const now = Date.now();
  for (const session of persistentStore.sessions.values()) {
    if (session.isRevoked || Date.parse(session.expiresAt) <= now) continue;
    const user = usersById.get(session.userId);
    const existing = grouped.get(session.userId);
    if (existing) {
      existing.activeSessions += 1;
      if (session.createdAt > existing.lastSignIn) existing.lastSignIn = session.createdAt;
      if (session.expiresAt > existing.expiresAt) existing.expiresAt = session.expiresAt;
    } else {
      grouped.set(session.userId, {
        userId: session.userId, name: user?.name || 'Account', email: user?.email || '',
        roleCode: user?.roleCode || session.roleCode as RoleCode, activeSessions: 1,
        lastSignIn: session.createdAt, expiresAt: session.expiresAt,
      });
    }
  }
  return res.json({ success: true, sessions: [...grouped.values()].sort((a, b) => b.lastSignIn.localeCompare(a.lastSignIn)) });
});

// API 404 Fallback Handler
app.all(/^\/api\/.*/, (_req: Request, res: Response) => {
  return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'API route not found' });
});

// Global Express 5 JSON error handler (prevents HTML stack trace leaks)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = status < 500 && err?.message ? err.message : 'Internal server error.';
  if (status >= 500) {
    console.error('[EXPRESS ERROR]', err instanceof Error ? err.message : err);
  }
  if (!res.headersSent) {
    res.status(status).json({ success: false, error: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message });
  }
});

// -------------------------------------------------------------
// Vite middleware in dev or static files in production
// -------------------------------------------------------------
async function setupApp() {
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    const frontendDirectory = path.join(__dirname, 'dist');
    const frontendIndex = path.join(frontendDirectory, 'index.html');
    if (existsSync(frontendIndex)) {
      app.use(express.static(frontendDirectory));
      // Express 5's path-to-regexp rejects the legacy '*' wildcard.
      // Keep the SPA fallback out of API paths so API 404s remain JSON responses.
      app.get(/^\/(?!api\/).*/, (_req, res, next) => {
        if (_req.path.startsWith('/api/')) {
          return next();
        }
        res.sendFile(frontendIndex);
      });
    } else {
      // Render serves the API behind Vercel, where the frontend is deployed separately.
      // A platform request to `/` must not try to stat a missing frontend bundle.
      app.get('/', (_req, res) => res.json({ status: 'API_ONLY', service: 'intellischedule-core' }));
      app.get(/^\/(?!api\/).*/, (_req, res) =>
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Frontend is served separately.' }),
      );
    }
  } else {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      app.use(express.static(path.join(__dirname, 'dist')));
    }
  }

  // Synchronize baseline users into Supabase Auth Authority in background non-blocking
  if (process.env.NODE_ENV !== 'production') {
    ensureSupabaseAuthUsers().catch(err => console.error('[SUPABASE AUTH SETUP ERROR]:', err));
  }
}

const isDirectEntrypoint =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === __filename;

if (!process.env.VERCEL && isDirectEntrypoint) {
  const effectivePort = Number(process.env.PORT) || 3000;
  void (async () => {
    await initializeAcademicPersistence();
    await setupApp();
    const httpServer = app.listen(effectivePort, "0.0.0.0", () => {
      console.log("[STARTUP] HTTP SERVER LISTENING", { port: effectivePort, address: "0.0.0.0" });
    });
    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.info(`[SHUTDOWN] ${signal} received; draining HTTP requests.`);
      const forceExit = setTimeout(() => {
        console.error('[SHUTDOWN] Grace period expired; closing remaining connections.');
        httpServer.closeAllConnections();
        process.exit(1);
      }, 10_000);
      forceExit.unref();
      httpServer.close(async (err) => {
        if (err) console.error('[SHUTDOWN] HTTP server close failed:', err.message);
        try {
          pgListenerStopped = true;
          await pgListenerClient?.end().catch(() => {});
          await academicDb?.close();
          console.info('[SHUTDOWN] Database pool closed.');
          process.exitCode = err ? 1 : 0;
        } catch (closeErr) {
          console.error('[SHUTDOWN] Database pool close failed:', closeErr instanceof Error ? closeErr.message : 'unknown error');
          process.exitCode = 1;
        } finally {
          clearTimeout(forceExit);
        }
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  })().catch((err) => {
    console.error('[STARTUP ERROR] Server initialization failed:', err instanceof Error ? err.message : 'unknown error');
    process.exitCode = 1;
  });
}

export default app;
