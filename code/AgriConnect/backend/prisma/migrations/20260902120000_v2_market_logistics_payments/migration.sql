-- V2: listing alerts, logistics, payments, price trends

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LISTING_PUBLISHED';

CREATE TYPE "LogisticsStatus" AS ENUM ('none', 'dispatched', 'in_transit', 'delivered');

CREATE TYPE "PaymentStatus" AS ENUM (
  'pending',
  'authorized',
  'held',
  'released',
  'refunded',
  'failed'
);

CREATE TYPE "PriceTrendSource" AS ENUM (
  'internal_listing',
  'internal_order',
  'agmarknet',
  'enam'
);

ALTER TABLE "orders"
  ADD COLUMN "logisticsStatus" "LogisticsStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "dispatchedAt" TIMESTAMPTZ(6),
  ADD COLUMN "inTransitAt" TIMESTAMPTZ(6),
  ADD COLUMN "logisticsDeliveredAt" TIMESTAMPTZ(6);

CREATE TABLE "price_trends" (
  "id" UUID NOT NULL,
  "crop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "district" TEXT,
  "source" "PriceTrendSource" NOT NULL,
  "pricePerUnit" DECIMAL(12,2) NOT NULL,
  "unit" "Unit" NOT NULL,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_trends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_trends_crop_state_recordedAt_idx"
  ON "price_trends" ("crop", "state", "recordedAt" DESC);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "providerRef" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "heldAt" TIMESTAMPTZ(6),
  "releasedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_orderId_key" ON "payments" ("orderId");
CREATE INDEX "payments_status_idx" ON "payments" ("status");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "buyer_crop_alerts" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "crop" TEXT,
  "state" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "buyer_crop_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "buyer_crop_alerts_userId_idx" ON "buyer_crop_alerts" ("userId");
CREATE UNIQUE INDEX "buyer_crop_alerts_user_crop_state_key"
  ON "buyer_crop_alerts" ("userId", "crop", "state");

ALTER TABLE "buyer_crop_alerts"
  ADD CONSTRAINT "buyer_crop_alerts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
