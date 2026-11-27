import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Db } from './db';

export type OneTimeTokenPurpose = 'email_verification' | 'password_reset';

export interface StoredOneTimeToken {
  id: string;
  email: string;
  tokenHash: string;
  purpose: OneTimeTokenPurpose;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  roleCode: string;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface PendingRegistration {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roleCode: string;
  roleName: string;
  department: string;
  createdAt: string;
  status?: 'PENDING';
}

export interface RateLimitRecord {
  count: number;
  resetsAt: number;
}

export interface LoadedState {
  oneTimeTokens: [string, StoredOneTimeToken][];
  sessions: [string, StoredSession][];
  pendingRegistrations: [string, PendingRegistration][];
  rateLimitBuckets: [string, RateLimitRecord][];
}

export interface StateBackend {
  load(): Promise<LoadedState>;
  saveOneTimeToken(token: StoredOneTimeToken): Promise<void>;
  deleteOneTimeToken(tokenHash: string): Promise<void>;
  saveSession(session: StoredSession): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  savePendingRegistration(pending: PendingRegistration): Promise<void>;
  deletePendingRegistration(email: string): Promise<void>;
  getRateLimitBucket(key: string): Promise<RateLimitRecord | null>;
  saveRateLimitBucket(key: string, record: RateLimitRecord): Promise<void>;
  cleanupExpired(nowIso: string, nowMs: number): Promise<void>;
  flush?(): Promise<void> | void;
}

const DATA_DIR = process.env.PERSISTENT_STATE_DIR || path.join(process.cwd(), 'data');
const STATE_FILE = process.env.PERSISTENT_STATE_PATH || path.join(DATA_DIR, 'persistent_state.json');

export class FileBackend implements StateBackend {
  private saveTimeout: NodeJS.Timeout | null = null;
  private pendingData: any = null;

  constructor(public dataDir: string = path.dirname(STATE_FILE), public stateFile: string = STATE_FILE) {
    this.ensureDir();
  }

  public ensureDir(): void {
    const targetDir = path.dirname(this.stateFile) || this.dataDir;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
      } else {
        fs.chmodSync(targetDir, 0o700);
      }
    } catch {
      // ignore
    }
  }

  async load(): Promise<LoadedState> {
    this.ensureDir();
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf-8');
        const data = JSON.parse(raw);
        return {
          oneTimeTokens: Array.isArray(data.oneTimeTokens) ? data.oneTimeTokens : [],
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          pendingRegistrations: Array.isArray(data.pendingRegistrations) ? data.pendingRegistrations : [],
          rateLimitBuckets: Array.isArray(data.rateLimitBuckets) ? data.rateLimitBuckets : [],
        };
      }
    } catch (err) {
      console.warn('[PERSISTENT STORE] Failed to load disk state, starting fresh:', err);
    }
    return {
      oneTimeTokens: [],
      sessions: [],
      pendingRegistrations: [],
      rateLimitBuckets: [],
    };
  }

  public scheduleSave(data: any): void {
    this.pendingData = data;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.flushSync();
    }, 250);
  }

  public flushSync(data?: any): void {
    if (data !== undefined) {
      this.pendingData = data;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (!this.pendingData) return;
    const dataToWrite = this.pendingData;
    this.pendingData = null;

    try {
      this.ensureDir();
      const tmpFile = `${this.stateFile}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToWrite, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmpFile, this.stateFile);
      try {
        fs.chmodSync(this.stateFile, 0o600);
      } catch {}
    } catch (err) {
      console.warn('[PERSISTENT STORE] Failed to atomic save state to disk:', err);
    }
  }

  async saveOneTimeToken(): Promise<void> {}
  async deleteOneTimeToken(): Promise<void> {}
  async saveSession(): Promise<void> {}
  async deleteSession(): Promise<void> {}
  async savePendingRegistration(): Promise<void> {}
  async deletePendingRegistration(): Promise<void> {}
  async getRateLimitBucket(): Promise<RateLimitRecord | null> { return null; }
  async saveRateLimitBucket(): Promise<void> {}
  async cleanupExpired(): Promise<void> {}

  flush(): void {
    this.flushSync();
  }
}

export class PostgresBackend implements StateBackend {
  constructor(private db: Db) {}

  async load(): Promise<LoadedState> {
    // A missing table, permissions issue, or network failure is not an empty store.
    // Let startup fail so the API never accepts requests with a partial auth state.
    const [tokens, sessions, pendings, buckets] = await Promise.all([
      this.db.query<any>(
        'select token_hash, email, purpose, expires_at, is_used, created_at from intellischedule.one_time_tokens'
      ),
      this.db.query<any>(
        'select token_hash, user_id, role_code, created_at, expires_at, is_revoked from intellischedule.sessions'
      ),
      this.db.query<any>(
        'select email, name, password_hash, role_code, role_name, department, created_at from intellischedule.pending_registrations'
      ),
      this.db.query<any>(
        'select key, count, resets_at from intellischedule.rate_limit_buckets'
      ),
    ]);

    return {
      oneTimeTokens: tokens.map(r => [r.token_hash, {
        id: 'ott_' + r.token_hash.slice(0, 8),
        email: r.email,
        tokenHash: r.token_hash,
        purpose: r.purpose,
        expiresAt: new Date(r.expires_at).toISOString(),
        isUsed: r.is_used,
        createdAt: new Date(r.created_at).toISOString(),
      }]),
      sessions: sessions.map(r => [r.token_hash, {
        id: 'sess_' + r.token_hash.slice(0, 8),
        userId: r.user_id,
        tokenHash: r.token_hash,
        roleCode: r.role_code,
        createdAt: new Date(r.created_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
        isRevoked: r.is_revoked,
      }]),
      pendingRegistrations: pendings.map(r => [r.email, {
        id: 'preg_' + r.email,
        email: r.email,
        name: r.name,
        passwordHash: r.password_hash,
        roleCode: r.role_code,
        roleName: r.role_name,
        department: r.department,
        createdAt: new Date(r.created_at).toISOString(),
      }]),
      rateLimitBuckets: buckets.map(r => [r.key, {
        count: r.count,
        resetsAt: new Date(r.resets_at).getTime(),
      }]),
    };
  }

  async saveOneTimeToken(token: StoredOneTimeToken): Promise<void> {
    await this.db.query(
      `insert into intellischedule.one_time_tokens (token_hash, email, purpose, expires_at, is_used, created_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (token_hash) do update set is_used = $5, expires_at = $4`,
      [token.tokenHash, token.email, token.purpose, token.expiresAt, token.isUsed, token.createdAt]
    );
  }

  async deleteOneTimeToken(tokenHash: string): Promise<void> {
    await this.db.query('delete from intellischedule.one_time_tokens where token_hash = $1', [tokenHash]);
  }

  async saveSession(session: StoredSession): Promise<void> {
    await this.db.query(
      `insert into intellischedule.sessions (token_hash, user_id, role_code, created_at, expires_at, is_revoked)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (token_hash) do update set is_revoked = $6, expires_at = $5`,
      [session.tokenHash, session.userId, session.roleCode, session.createdAt, session.expiresAt, session.isRevoked]
    );
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('delete from intellischedule.sessions where token_hash = $1', [tokenHash]);
  }

  async savePendingRegistration(pending: PendingRegistration): Promise<void> {
    await this.db.query(
      `insert into intellischedule.pending_registrations (email, name, password_hash, role_code, role_name, department, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (email) do update set name = $2, password_hash = $3, role_code = $4, role_name = $5, department = $6, created_at = $7`,
      [pending.email, pending.name, pending.passwordHash, pending.roleCode, pending.roleName, pending.department, pending.createdAt]
    );
  }

  async deletePendingRegistration(email: string): Promise<void> {
    await this.db.query('delete from intellischedule.pending_registrations where email = $1', [email]);
  }

  async getRateLimitBucket(key: string): Promise<RateLimitRecord | null> {
    const rows = await this.db.query<any>('select count, resets_at from intellischedule.rate_limit_buckets where key = $1', [key]);
    if (!rows.length) return null;
    return { count: rows[0].count, resetsAt: new Date(rows[0].resets_at).getTime() };
  }

  async saveRateLimitBucket(key: string, record: RateLimitRecord): Promise<void> {
    await this.db.query(
      `insert into intellischedule.rate_limit_buckets (key, count, resets_at, updated_at)
       values ($1, $2, $3, now())
       on conflict (key) do update set count = $2, resets_at = $3, updated_at = now()`,
      [key, record.count, new Date(record.resetsAt).toISOString()]
    );
  }

  async cleanupExpired(nowIso: string, nowMs: number): Promise<void> {
    await this.db.tx(async (query) => {
      await query('delete from intellischedule.one_time_tokens where is_used = true or expires_at < $1', [nowIso]);
      await query('delete from intellischedule.sessions where is_revoked = true or expires_at < $1', [nowIso]);
      await query('delete from intellischedule.rate_limit_buckets where resets_at < $1', [new Date(nowMs).toISOString()]);
    });
  }
}

export class PersistentStore {
  public oneTimeTokens = new Map<string, StoredOneTimeToken>();
  public sessions = new Map<string, StoredSession>();
  public pendingRegistrations = new Map<string, PendingRegistration>();
  public rateLimitBuckets = new Map<string, RateLimitRecord>();

  public backend: StateBackend;
  private fileBackend: FileBackend | null = null;
  private isLoaded = false;

  private reportBackgroundFailure(operation: string, err: unknown): void {
    console.error(`[PERSISTENT STORE] ${operation} failed:`, err instanceof Error ? err.message : 'unknown error');
  }

  constructor(backend?: StateBackend) {
    if (backend) {
      this.backend = backend;
      if (backend instanceof FileBackend) {
        this.fileBackend = backend;
      }
    } else {
      const isProduction = process.env.NODE_ENV === 'production';
      const dbUrl = process.env.DATABASE_URL;

      if (isProduction) {
        if (!dbUrl) {
          throw new Error('[PERSISTENT STORE] Postgres is required in production (DATABASE_URL missing). Refusing to boot.');
        }
        throw new Error('[PERSISTENT STORE] Production Postgres backend was not initialized.');
      }

      this.fileBackend = new FileBackend();
      this.backend = this.fileBackend;
    }

    this.loadInitialStateSync();

    setInterval(() => this.cleanupExpiredRecords(), 10 * 60 * 1000).unref();

    const flushOnExit = () => {
      if (this.fileBackend) {
        this.fileBackend.flushSync();
      }
    };
    process.on('exit', flushOnExit);
    process.on('SIGINT', flushOnExit);
    process.on('SIGTERM', flushOnExit);
  }

  private loadInitialStateSync(): void {
    if (this.fileBackend) {
      try {
        this.fileBackend.ensureDir();
        if (fs.existsSync(this.fileBackend.stateFile)) {
          const raw = fs.readFileSync(this.fileBackend.stateFile, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data.oneTimeTokens)) this.oneTimeTokens = new Map(data.oneTimeTokens);
          if (Array.isArray(data.sessions)) this.sessions = new Map(data.sessions);
          if (Array.isArray(data.pendingRegistrations)) this.pendingRegistrations = new Map(data.pendingRegistrations);
          if (Array.isArray(data.rateLimitBuckets)) this.rateLimitBuckets = new Map(data.rateLimitBuckets);
        }
      } catch (err) {
        console.warn('[PERSISTENT STORE] Failed to load synchronous file state:', err);
      }
    }
  }

  public async initAsync(): Promise<void> {
    if (this.isLoaded) return;
    const state = await this.backend.load();
    // The backend is authoritative, including when a table is intentionally empty.
    this.oneTimeTokens = new Map(state.oneTimeTokens);
    this.sessions = new Map(state.sessions);
    this.pendingRegistrations = new Map(state.pendingRegistrations);
    this.rateLimitBuckets = new Map(state.rateLimitBuckets);
    this.isLoaded = true;
  }

  public serializeState(): any {
    return {
      oneTimeTokens: Array.from(this.oneTimeTokens.entries()),
      sessions: Array.from(this.sessions.entries()),
      pendingRegistrations: Array.from(this.pendingRegistrations.entries()),
      rateLimitBuckets: Array.from(this.rateLimitBuckets.entries()),
    };
  }

  public saveToDisk(): void {
    if (this.fileBackend) {
      this.fileBackend.scheduleSave(this.serializeState());
    }
  }

  public flushSync(): void {
    if (this.fileBackend) {
      this.fileBackend.flushSync(this.serializeState());
    }
  }

  public hashToken(raw: string): string {
    return crypto.createHash('sha256').update(String(raw)).digest('hex');
  }

  // --- One-Time Tokens ---
  public issueOneTimeToken(
    email: string,
    purpose: OneTimeTokenPurpose,
    ttlMs: number
  ): { rawToken: string; record: StoredOneTimeToken } {
    const normalizedEmail = email.trim().toLowerCase();
    for (const record of this.oneTimeTokens.values()) {
      if (record.email === normalizedEmail && record.purpose === purpose && !record.isUsed) {
        record.isUsed = true;
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const record: StoredOneTimeToken = {
      id: 'ott_' + crypto.randomUUID(),
      email: normalizedEmail,
      tokenHash,
      purpose,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      isUsed: false,
      createdAt: new Date().toISOString(),
    };

    this.oneTimeTokens.set(tokenHash, record);
    this.saveToDisk();
    return { rawToken, record };
  }

  public async persistOneTimeToken(rawToken: string): Promise<void> {
    const token = this.oneTimeTokens.get(this.hashToken(rawToken));
    if (!token) throw new Error('One-time token was not created.');
    const relatedTokens = [...this.oneTimeTokens.values()].filter(
      (candidate) => candidate.email === token.email && candidate.purpose === token.purpose,
    );
    await Promise.all(relatedTokens.map((candidate) => this.backend.saveOneTimeToken(candidate)));
  }

  public consumeOneTimeToken(rawToken: string, expectedPurpose: OneTimeTokenPurpose): StoredOneTimeToken | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = this.hashToken(rawToken);
    const record = this.oneTimeTokens.get(tokenHash);
    if (!record) return null;
    if (record.purpose !== expectedPurpose) return null;
    if (record.isUsed) return null;
    if (new Date(record.expiresAt) < new Date()) return null;

    record.isUsed = true;
    this.saveToDisk();
    this.backend.saveOneTimeToken(record).catch((err) => this.reportBackgroundFailure('Consume one-time token', err));
    return record;
  }

  public validateOneTimeToken(rawToken: string, expectedPurpose: OneTimeTokenPurpose): StoredOneTimeToken | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = this.hashToken(rawToken);
    const record = this.oneTimeTokens.get(tokenHash);
    if (!record) return null;
    if (record.purpose !== expectedPurpose) return null;
    if (record.isUsed) return null;
    if (new Date(record.expiresAt) < new Date()) return null;

    return record;
  }

  public async consumeOneTimeTokenDurably(rawToken: string, expectedPurpose: OneTimeTokenPurpose): Promise<StoredOneTimeToken | null> {
    const record = this.validateOneTimeToken(rawToken, expectedPurpose);
    if (!record) return null;
    record.isUsed = true;
    try {
      await this.backend.saveOneTimeToken(record);
    } catch (err) {
      record.isUsed = false;
      this.saveToDisk();
      throw err;
    }
    this.saveToDisk();
    return record;
  }

  public invalidateUserTokens(email: string): void {
    const normalized = email.trim().toLowerCase();
    for (const tok of this.oneTimeTokens.values()) {
      if (tok.email === normalized) {
        tok.isUsed = true;
        this.backend.saveOneTimeToken(tok).catch((err) => this.reportBackgroundFailure('Invalidate user token', err));
      }
    }
    this.saveToDisk();
  }

  public async invalidateUserTokensDurably(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const tokens = [...this.oneTimeTokens.values()].filter((token) => token.email === normalized);
    for (const token of tokens) token.isUsed = true;
    this.saveToDisk();
    await Promise.all(tokens.map((token) => this.backend.saveOneTimeToken(token)));
  }

  // --- Sessions ---
  public createSession(rawToken: string, userId: string, roleCode: string, ttlMs: number = 24 * 60 * 60 * 1000): StoredSession {
    const tokenHash = this.hashToken(rawToken);
    const session: StoredSession = {
      id: 'sess_' + crypto.randomUUID(),
      userId,
      tokenHash,
      roleCode,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      isRevoked: false,
    };
    this.sessions.set(tokenHash, session);
    this.saveToDisk();
    return session;
  }

  public async persistSession(rawToken: string): Promise<void> {
    const session = this.sessions.get(this.hashToken(rawToken));
    if (!session) throw new Error('Session was not created.');
    await this.backend.saveSession(session);
  }

  public getSession(rawToken: string): StoredSession | null {
    if (!rawToken) return null;
    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session || session.isRevoked || new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return session;
  }

  public revokeSession(rawToken: string): void {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (session) {
      session.isRevoked = true;
      this.backend.saveSession(session).catch((err) => this.reportBackgroundFailure('Revoke session', err));
    } else {
      const revokedSession: StoredSession = {
        id: 'sess_revoked_' + crypto.randomUUID(),
        userId: 'revoked_token',
        tokenHash,
        roleCode: 'STUDENT',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isRevoked: true,
      };
      this.sessions.set(tokenHash, revokedSession);
      this.backend.saveSession(revokedSession).catch((err) => this.reportBackgroundFailure('Persist revoked session', err));
    }
    this.saveToDisk();
  }

  public async revokeSessionDurably(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    let session = this.sessions.get(tokenHash);
    if (!session) {
      session = {
        id: 'sess_revoked_' + crypto.randomUUID(),
        userId: 'revoked_token',
        tokenHash,
        roleCode: 'STUDENT',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isRevoked: true,
      };
      this.sessions.set(tokenHash, session);
    } else {
      session.isRevoked = true;
    }
    this.saveToDisk();
    await this.backend.saveSession(session);
  }

  public revokeUserSessions(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.isRevoked = true;
        this.backend.saveSession(session).catch((err) => this.reportBackgroundFailure('Revoke user session', err));
      }
    }
    this.saveToDisk();
  }

  public async revokeUserSessionsDurably(userId: string): Promise<void> {
    const sessions = [...this.sessions.values()].filter((session) => session.userId === userId);
    for (const session of sessions) session.isRevoked = true;
    this.saveToDisk();
    await Promise.all(sessions.map((session) => this.backend.saveSession(session)));
  }

  public forgetUserSessions(userId: string): void {
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(tokenHash);
    }
    this.saveToDisk();
  }

  // --- Pending Registrations ---
  public setPendingRegistration(email: string, pending: PendingRegistration): void {
    const normalized = email.trim().toLowerCase();
    this.pendingRegistrations.set(normalized, pending);
    this.saveToDisk();
  }

  public async persistPendingRegistration(email: string): Promise<void> {
    const pending = this.pendingRegistrations.get(email.trim().toLowerCase());
    if (!pending) throw new Error('Pending registration was not created.');
    await this.backend.savePendingRegistration(pending);
  }

  public getPendingRegistration(email: string): PendingRegistration | null {
    return this.pendingRegistrations.get(email.trim().toLowerCase()) || null;
  }

  public deletePendingRegistration(email: string): void {
    const normalized = email.trim().toLowerCase();
    this.pendingRegistrations.delete(normalized);
    this.saveToDisk();
    this.backend.deletePendingRegistration(normalized).catch((err) => this.reportBackgroundFailure('Delete pending registration', err));
  }

  public async deletePendingRegistrationDurably(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const previous = this.pendingRegistrations.get(normalized);
    this.pendingRegistrations.delete(normalized);
    this.saveToDisk();
    try {
      await this.backend.deletePendingRegistration(normalized);
    } catch (err) {
      if (previous) this.pendingRegistrations.set(normalized, previous);
      this.saveToDisk();
      throw err;
    }
  }

  // --- Rate Limit Buckets ---
  public checkRateLimit(key: string, limit: number, windowMs: number): { limited: boolean; retryAfterSec: number } {
    const now = Date.now();
    const record = this.rateLimitBuckets.get(key);

    if (!record || record.resetsAt < now) {
      const newRecord = { count: 1, resetsAt: now + windowMs };
      this.rateLimitBuckets.set(key, newRecord);
      this.saveToDisk();
      this.backend.saveRateLimitBucket(key, newRecord).catch((err) => this.reportBackgroundFailure('Save rate-limit bucket', err));
      return { limited: false, retryAfterSec: 0 };
    }

    if (record.count >= limit) {
      const retryAfterSec = Math.ceil((record.resetsAt - now) / 1000);
      return { limited: true, retryAfterSec: Math.max(1, retryAfterSec) };
    }

    record.count++;
    this.saveToDisk();
    this.backend.saveRateLimitBucket(key, record).catch((err) => this.reportBackgroundFailure('Update rate-limit bucket', err));
    return { limited: false, retryAfterSec: 0 };
  }

  // --- TTL Cleanup ---
  public cleanupExpiredRecords(): void {
    const now = Date.now();
    const nowIso = new Date().toISOString();

    for (const [key, tok] of this.oneTimeTokens.entries()) {
      if (tok.isUsed || tok.expiresAt < nowIso) {
        this.oneTimeTokens.delete(key);
      }
    }

    for (const [key, sess] of this.sessions.entries()) {
      if (sess.isRevoked || sess.expiresAt < nowIso) {
        this.sessions.delete(key);
      }
    }

    for (const [key, record] of this.rateLimitBuckets.entries()) {
      if (record.resetsAt < now) {
        this.rateLimitBuckets.delete(key);
      }
    }

    this.saveToDisk();
    this.backend.cleanupExpired(nowIso, now).catch((err) => {
      console.error('[PERSISTENT STORE] Expired-record cleanup failed:', err instanceof Error ? err.message : 'unknown error');
    });
  }
}

/** Shared PostgreSQL pool used by auth persistence and the academic runtime. */
export let persistentDatabase: Db | null = null;

async function createPersistentStore(): Promise<PersistentStore> {
  if (process.env.NODE_ENV !== 'production') return new PersistentStore();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('[PERSISTENT STORE] Postgres is required in production (DATABASE_URL missing). Refusing to boot.');
  }

  const { connectDb } = await import('./db');
  const db = await connectDb(databaseUrl);
  persistentDatabase = db;
  const store = new PersistentStore(new PostgresBackend(db));
  await store.initAsync();
  return store;
}

// Wait for the durable session store and its schema before server.ts can accept requests.
export const persistentStore = await createPersistentStore();
