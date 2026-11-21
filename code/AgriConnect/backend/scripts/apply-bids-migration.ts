import { connectDatabase, disconnectDatabase, getPrismaClient } from '../src/config/db.js';

async function main(): Promise<void> {
  await connectDatabase();
  const prisma = getPrismaClient();

  console.info('Checking if bids table exists...');
  const tableCheck = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'bids'
    ) AS exists`,
  );

  if (tableCheck[0]?.exists) {
    console.info('bids table already exists. Migration complete.');
    await disconnectDatabase();
    return;
  }

  console.info('Applying bids DDL migration...');

  // 1. Create BidStatus enum if not exists
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "BidStatus" AS ENUM ('pending', 'accepted', 'rejected', 'countered', 'withdrawn');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // 2. Add notification enum values if not exist
  const newNotifTypes = ['BID_RECEIVED', 'BID_ACCEPTED', 'BID_REJECTED', 'BID_COUNTERED'];
  for (const notifType of newNotifTypes) {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS '${notifType}';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  // 3. Create bids table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "bids" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "listingId" UUID NOT NULL,
      "buyerId" UUID NOT NULL,
      "farmerId" UUID NOT NULL,
      "pricePerUnit" NUMERIC(12, 2) NOT NULL,
      "quantity" NUMERIC(12, 3) NOT NULL,
      "unit" "Unit" NOT NULL,
      "priceTotal" NUMERIC(12, 2) NOT NULL,
      "status" "BidStatus" NOT NULL DEFAULT 'pending',
      "counterPrice" NUMERIC(12, 2),
      "notes" TEXT,
      "rejectionReason" TEXT,
      "orderId" UUID,
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "bids_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "bids_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "bids_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "bids_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // 4. Create Indexes
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "bids_listingId_status_idx" ON "bids"("listingId", "status");
    CREATE INDEX IF NOT EXISTS "bids_buyerId_status_idx" ON "bids"("buyerId", "status");
    CREATE INDEX IF NOT EXISTS "bids_farmerId_status_idx" ON "bids"("farmerId", "status");
  `);

  console.info('bids table and indexes created successfully.');
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error('Migration failed:', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
