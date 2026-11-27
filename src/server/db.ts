import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type Row = Record<string, any>;
export type Query = <T = Row>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface Db {
  query: Query;
  /** Runs `fn` inside one transaction; rolls back if it throws. */
  tx<T>(fn: (query: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

/**
 * DATABASE_URL: Supabase Postgres connection string (Project Settings -> Database).
 * `pglite:memory` / `pglite:<dir>` runs an embedded Postgres for local development and tests only.
 */
export async function connectDb(url: string): Promise<Db> {
  const db = url.startsWith('pglite:') ? await connectPglite(url.slice('pglite:'.length)) : await connectPg(url);
  await db.tx(async (query) => {
    await query('create schema if not exists intellischedule');
    await query(`create table if not exists intellischedule.application_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    await query(`create table if not exists intellischedule.application_migration_lock (
      id integer primary key check (id = 1)
    )`);
    await query('alter table intellischedule.application_migrations enable row level security');
    await query('alter table intellischedule.application_migration_lock enable row level security');
    await query('insert into intellischedule.application_migration_lock (id) values (1) on conflict (id) do nothing');
  });
  const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const migration of migrations) {
    const schema = fs.readFileSync(path.join(MIGRATIONS_DIR, migration), 'utf8');
    const checksum = crypto.createHash('sha256').update(schema).digest('hex');
    await db.tx(async (query) => {
      // Serialize concurrent app starts and record a migration in the same
      // transaction as its DDL, so a failed migration can be retried safely.
      await query('insert into intellischedule.application_migration_lock (id) values (1) on conflict (id) do nothing');
      await query('select id from intellischedule.application_migration_lock where id = 1 for update');
      const applied = await query<{ checksum: string }>(
        'select checksum from intellischedule.application_migrations where name = $1',
        [migration],
      );
      if (applied[0]) {
        if (applied[0].checksum !== checksum) {
          throw new Error(`Applied database migration ${migration} has changed. Add a new migration instead of editing it.`);
        }
        return;
      }

      await query(schema);
      await query(
        'insert into intellischedule.application_migrations (name, checksum) values ($1, $2)',
        [migration, checksum],
      );
    });
  }
  return db;
}

async function connectPg(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const parsed = new URL(url);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  // sslmode in the URL would override the ssl option below, so TLS is configured here only.
  parsed.searchParams.delete('sslmode');
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  if (!isLocal && !ca) {
    console.warn('[db] DATABASE_SSL_CA not set: connecting with TLS but without verifying the server certificate. Set it to the Supabase CA certificate (Database settings -> SSL) to enable verification.');
  }
  const pool = new pg.Pool({
    connectionString: parsed.toString(),
    max: Number(process.env.PG_POOL_MAX) || 5,
    ssl: isLocal ? false : ca ? { ca } : { rejectUnauthorized: false },
  });
  pool.on('error', (err: Error) => console.error('[db] idle client error:', err.message));

  const query: Query = async (sql, params) => (await pool.query(sql, params as any[])).rows;
  return {
    query,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(async (sql, params) => (await client.query(sql, params as any[])).rows);
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir: string): Promise<Db> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL=pglite:* is for local development and tests only. Use the Supabase connection string in production.');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir !== 'memory') fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir === 'memory' ? undefined : dir);
  try {
    await pg.waitReady;
  } catch (err) {
    throw new Error(
      `Could not open the local database in "${dir}" (${(err as Error).message}). It is probably damaged, which happens if the server is killed mid-write or two copies run at once. Stop the server, delete the "${dir}" folder and start again (sample data is reloaded automatically).`,
    );
  }
  // Multi-statement SQL (the schema file) needs exec(); parameterised SQL needs query().
  const run = async (target: any, sql: string, params?: unknown[]) =>
    params?.length ? (await target.query(sql, params)).rows : ((await target.exec(sql)).at(-1)?.rows ?? []);
  return {
    query: (sql, params) => run(pg, sql, params),
    tx: (fn) => pg.transaction((tx: any) => fn((sql, params) => run(tx, sql, params))),
    close: () => pg.close(),
  };
}
