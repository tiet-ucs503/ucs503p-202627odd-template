/**
 * Applies pending migrations when DIRECT_URL (5432) is unreachable but DATABASE_URL works.
 * Registers the migration in _prisma_migrations so `prisma migrate deploy` stays consistent.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectDatabase, disconnectDatabase, getPrismaClient } from '../src/config/db.ts';

const MIGRATION_NAME = '20260831120000_messages_reviews';

async function tableExists(table: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    table,
  );
  return rows[0]?.exists === true;
}

async function migrationRecorded(): Promise<boolean> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE migration_name = $1`,
    MIGRATION_NAME,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function recordMigration(checksum: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (gen_random_uuid(), $1, NOW(), $2, NULL, NULL, NOW(), 1)
     ON CONFLICT DO NOTHING`,
    checksum,
    MIGRATION_NAME,
  );
}

async function main(): Promise<void> {
  await connectDatabase();
  const prisma = getPrismaClient();

  const messagesExist = await tableExists('messages');
  const reviewsExist = await tableExists('reviews');
  const alreadyRecorded = await migrationRecorded();

  if (messagesExist && reviewsExist && alreadyRecorded) {
    console.info('Migration already applied: messages and reviews tables exist.');
    await disconnectDatabase();
    return;
  }

  if (!messagesExist || !reviewsExist) {
    const sqlPath = resolve(
      import.meta.dirname,
      '../prisma/migrations/20260831120000_messages_reviews/migration.sql',
    );
    const sql = readFileSync(sqlPath, 'utf8');

    // Enum ADD VALUE cannot run inside a transaction on older PG; run it first.
    const enumMatch = sql.match(/ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_RECEIVED';/);
    if (enumMatch) {
      try {
        await prisma.$executeRawUnsafe(enumMatch[0]);
        console.info('Added NotificationType.MESSAGE_RECEIVED');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('already exists')) {
          throw error;
        }
        console.info('NotificationType.MESSAGE_RECEIVED already exists');
      }
    }

    const ddl = sql
      .replace(/ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_RECEIVED';\s*/i, '')
      .trim();

    await prisma.$executeRawUnsafe(ddl);
    console.info('Created messages and reviews tables.');
  }

  if (!alreadyRecorded) {
    const sqlPath = resolve(
      import.meta.dirname,
      '../prisma/migrations/20260831120000_messages_reviews/migration.sql',
    );
    const checksum = createHash('sha256').update(readFileSync(sqlPath, 'utf8')).digest('hex');
    await recordMigration(checksum);
    console.info('Recorded migration in _prisma_migrations.');
  }

  const counts = {
    messages: await prisma.message.count(),
    reviews: await prisma.review.count(),
  };
  console.info('Verified:', counts);

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
