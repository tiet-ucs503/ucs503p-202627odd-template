/**
 * One-shot: remove cancelled smoke/test orders so the orders list looks natural again.
 * Keeps the four stable demo order IDs from seed-demo.ts.
 */
import { disconnectDatabase, getPrismaClient } from '../src/config/db.js';

const KEEP = [
  'e1111111-1111-4111-8111-111111111111',
  'e2222222-2222-4222-8222-222222222222',
  'e3333333-3333-4333-8333-333333333333',
  'e4444444-4444-4444-8444-444444444444',
] as const;

const DEMO_LISTINGS = [
  'd1111111-1111-4111-8111-111111111111',
  'd2222222-2222-4222-8222-222222222222',
  'd3333333-3333-4333-8333-333333333333',
  'd4444444-4444-4444-8444-444444444444',
] as const;

async function main() {
  const prisma = getPrismaClient();
  const junk = await prisma.order.findMany({
    where: { status: 'cancelled', id: { notIn: [...KEEP] } },
    select: { id: true },
  });
  const ids = junk.map((o) => o.id);
  console.info(`junk_cancelled=${ids.length}`);

  if (ids.length > 0) {
    await prisma.message.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.review.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.notification.deleteMany({
      where: { relatedEntityType: 'Order', relatedEntityId: { in: ids } },
    });
    const deleted = await prisma.order.deleteMany({ where: { id: { in: ids } } });
    console.info(`deleted_orders=${deleted.count}`);
  }

  const audit = await prisma.listing.findMany({
    where: { crop: { startsWith: 'Audit Wheat' }, id: { notIn: [...DEMO_LISTINGS] } },
    select: { id: true },
  });
  if (audit.length > 0) {
    const lids = audit.map((l) => l.id);
    const stillLinked = await prisma.order.count({ where: { listingId: { in: lids } } });
    if (stillLinked === 0) {
      await prisma.listingPhoto.deleteMany({ where: { listingId: { in: lids } } });
      const d = await prisma.listing.deleteMany({ where: { id: { in: lids } } });
      console.info(`deleted_audit_listings=${d.count}`);
    } else {
      console.info(`audit_listings_still_linked=${stillLinked}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
