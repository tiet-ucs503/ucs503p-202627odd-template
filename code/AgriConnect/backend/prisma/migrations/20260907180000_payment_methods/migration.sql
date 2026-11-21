-- Payment methods for escrow-style order payments (UPI / card / netbanking / cash on delivery).
CREATE TYPE "PaymentMethod" AS ENUM ('upi', 'card', 'netbanking', 'cod');

ALTER TABLE "payments"
  ADD COLUMN "method" "PaymentMethod",
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMPTZ(6);

-- payments / price_trends / buyer_crop_alerts were created after the RLS lockdown
-- migration, so they never had row level security enabled. Express connects as the
-- table owner and is unaffected; this only blocks direct anon/authenticated access.
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_trends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_crop_alerts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "payments" FROM anon, authenticated;
REVOKE ALL ON TABLE "price_trends" FROM anon, authenticated;
REVOKE ALL ON TABLE "buyer_crop_alerts" FROM anon, authenticated;
