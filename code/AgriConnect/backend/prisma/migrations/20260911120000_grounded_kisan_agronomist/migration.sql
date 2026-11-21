-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AGRONOMIST';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADVISORY_ESCALATION';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EscalationStatus" AS ENUM ('pending', 'claimed', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "advisory_escalations" (
    "id" UUID NOT NULL,
    "farmerId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "EscalationStatus" NOT NULL DEFAULT 'pending',
    "assignedToId" UUID,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "advisory_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "advisory_escalations_status_createdAt_idx" ON "advisory_escalations"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "advisory_escalations_farmerId_createdAt_idx" ON "advisory_escalations"("farmerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "advisory_escalations_assignedToId_idx" ON "advisory_escalations"("assignedToId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "advisory_escalations" ADD CONSTRAINT "advisory_escalations_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "advisory_escalations" ADD CONSTRAINT "advisory_escalations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
