import type { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';
import {
  BuyerType,
  DeliveryMode,
  ListingStatus,
  LogisticsStatus,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Role,
  Unit,
} from '../src/generated/prisma/client.js';

/** Stable IDs so re-seeding updates the same demo rows. */
export const DEMO_IDS = {
  farmerKabir: 'c1111111-1111-4111-8111-111111111111',
  farmerRavi: 'a1111111-1111-4111-8111-111111111111',
  buyerAman: 'b1111111-1111-4111-8111-111111111111',
  buyerNeha: 'b2222222-2222-4222-8222-222222222222',
  listingWheat: 'd1111111-1111-4111-8111-111111111111',
  listingRice: 'd2222222-2222-4222-8222-222222222222',
  listingTomato: 'd3333333-3333-4333-8333-333333333333',
  listingOnion: 'd4444444-4444-4444-8444-444444444444',
  orderPending: 'e1111111-1111-4111-8111-111111111111',
  orderAccepted: 'e2222222-2222-4222-8222-222222222222',
  orderConfirmed: 'e3333333-3333-4333-8333-333333333333',
  orderFulfilled: 'e4444444-4444-4444-8444-444444444444',
} as const;

const DEMO_PASSWORD_DEFAULT = 'Demo@AgriConnect1';

const PLACEHOLDER_PHOTOS = {
  wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1200&auto=format&fit=crop&q=80',
  tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200&auto=format&fit=crop&q=80',
  onion: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=1200&auto=format&fit=crop&q=80',
} as const;

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

function daysFromNow(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

function dateOnly(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return new Date(date.toISOString().slice(0, 10));
}

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? DEMO_PASSWORD_DEFAULT;
  if (demoPassword.length < 12) {
    throw new Error('DEMO_USER_PASSWORD must be at least 12 characters when seeding demo data.');
  }

  const demoHash = await hashPassword(demoPassword);

  const farmerKabir = await prisma.user.upsert({
    where: { email: 'kabir.manchanda@demo.agriconnect.local' },
    create: {
      id: DEMO_IDS.farmerKabir,
      email: 'kabir.manchanda@demo.agriconnect.local',
      passwordHash: demoHash,
      name: 'Kabir Manchanda',
      role: Role.FARMER,
      phone: '+91 98765 43210',
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      verified: true,
      farmerProfile: {
        create: {
          farmName: 'Manchanda Family Farm',
          region: 'Ludhiana',
          ratingAvg: '4.70',
        },
      },
    },
    update: {
      passwordHash: demoHash,
      name: 'Kabir Manchanda',
      verified: true,
      isSuspended: false,
      deletedAt: null,
      farmerProfile: {
        upsert: {
          create: { farmName: 'Manchanda Family Farm', region: 'Ludhiana', ratingAvg: '4.70' },
          update: { farmName: 'Manchanda Family Farm', region: 'Ludhiana', ratingAvg: '4.70' },
        },
      },
    },
    include: { farmerProfile: true },
  });

  const farmerRavi = await prisma.user.upsert({
    where: { email: 'ravi.kumar@demo.agriconnect.local' },
    create: {
      id: DEMO_IDS.farmerRavi,
      email: 'ravi.kumar@demo.agriconnect.local',
      passwordHash: demoHash,
      name: 'Ravi Kumar',
      role: Role.FARMER,
      phone: '+91 98140 11223',
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      verified: true,
      farmerProfile: {
        create: {
          farmName: 'Green Fields Cooperative',
          region: 'Amritsar',
          ratingAvg: '4.50',
        },
      },
    },
    update: {
      passwordHash: demoHash,
      verified: true,
      isSuspended: false,
      deletedAt: null,
      farmerProfile: {
        upsert: {
          create: { farmName: 'Green Fields Cooperative', region: 'Amritsar', ratingAvg: '4.50' },
          update: { farmName: 'Green Fields Cooperative', region: 'Amritsar', ratingAvg: '4.50' },
        },
      },
    },
    include: { farmerProfile: true },
  });

  const buyerAman = await prisma.user.upsert({
    where: { email: 'aman.singh@demo.agriconnect.local' },
    create: {
      id: DEMO_IDS.buyerAman,
      email: 'aman.singh@demo.agriconnect.local',
      passwordHash: demoHash,
      name: 'Aman Singh',
      role: Role.BUYER,
      phone: '+91 99887 76655',
      state: 'Delhi',
      district: 'New Delhi',
      verified: true,
      buyerProfile: {
        create: {
          businessName: 'Singh Grain Traders',
          buyerType: BuyerType.trader,
          ratingAvg: '4.60',
        },
      },
    },
    update: {
      passwordHash: demoHash,
      verified: true,
      isSuspended: false,
      deletedAt: null,
      buyerProfile: {
        upsert: {
          create: {
            businessName: 'Singh Grain Traders',
            buyerType: BuyerType.trader,
            ratingAvg: '4.60',
          },
          update: {
            businessName: 'Singh Grain Traders',
            buyerType: BuyerType.trader,
            ratingAvg: '4.60',
          },
        },
      },
    },
  });

  const buyerNeha = await prisma.user.upsert({
    where: { email: 'neha.verma@demo.agriconnect.local' },
    create: {
      id: DEMO_IDS.buyerNeha,
      email: 'neha.verma@demo.agriconnect.local',
      passwordHash: demoHash,
      name: 'Neha Verma',
      role: Role.BUYER,
      phone: '+91 98712 34567',
      state: 'Punjab',
      district: 'Chandigarh',
      verified: true,
      buyerProfile: {
        create: {
          businessName: 'Verma Fresh Retail',
          buyerType: BuyerType.retailer,
          ratingAvg: '4.80',
        },
      },
    },
    update: {
      passwordHash: demoHash,
      verified: true,
      isSuspended: false,
      deletedAt: null,
      buyerProfile: {
        upsert: {
          create: {
            businessName: 'Verma Fresh Retail',
            buyerType: BuyerType.retailer,
            ratingAvg: '4.80',
          },
          update: {
            businessName: 'Verma Fresh Retail',
            buyerType: BuyerType.retailer,
            ratingAvg: '4.80',
          },
        },
      },
    },
  });

  const kabirProfileId = farmerKabir.farmerProfile?.id;
  const raviProfileId = farmerRavi.farmerProfile?.id;
  if (!kabirProfileId || !raviProfileId) {
    throw new Error('Demo farmer profiles missing after upsert.');
  }

  const listingWheat = await prisma.listing.upsert({
    where: { id: DEMO_IDS.listingWheat },
    create: {
      id: DEMO_IDS.listingWheat,
      farmerProfileId: kabirProfileId,
      crop: 'Wheat',
      category: 'grains',
      variety: 'PBW-343',
      quantity: '450.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      harvestDate: dateOnly(-14),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'Freshly harvested sharbati wheat, cleaned and bagged. Ideal for flour mills.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 128,
      interestCount: 6,
      expiresAt: daysFromNow(21),
    },
    update: {
      status: ListingStatus.active,
      quantity: '450.000',
      expiresAt: daysFromNow(21),
      deletedAt: null,
    },
  });

  await upsertListingPhoto(prisma, listingWheat.id, 'demo/wheat.jpg', PLACEHOLDER_PHOTOS.wheat);

  const listingRice = await prisma.listing.upsert({
    where: { id: DEMO_IDS.listingRice },
    create: {
      id: DEMO_IDS.listingRice,
      farmerProfileId: kabirProfileId,
      crop: 'Rice',
      category: 'grains',
      variety: 'Basmati',
      quantity: '180.000',
      unit: Unit.quintal,
      pricePerUnit: '3200.00',
      harvestDate: dateOnly(-10),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'Premium basmati, long grain, low moisture. Direct from farm.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 89,
      interestCount: 3,
      expiresAt: daysFromNow(18),
    },
    update: {
      status: ListingStatus.active,
      quantity: '180.000',
      expiresAt: daysFromNow(18),
      deletedAt: null,
    },
  });

  await upsertListingPhoto(prisma, listingRice.id, 'demo/rice.jpg', PLACEHOLDER_PHOTOS.rice);

  await prisma.listing.upsert({
    where: { id: DEMO_IDS.listingTomato },
    create: {
      id: DEMO_IDS.listingTomato,
      farmerProfileId: raviProfileId,
      crop: 'Tomato',
      category: 'vegetables',
      variety: 'Hybrid',
      quantity: '120.000',
      unit: Unit.quintal,
      pricePerUnit: '1800.00',
      harvestDate: dateOnly(-3),
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      description: 'Vine-ripened tomatoes, suitable for mandi and retail.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 54,
      interestCount: 2,
      expiresAt: daysFromNow(7),
    },
    update: {
      status: ListingStatus.active,
      expiresAt: daysFromNow(7),
      deletedAt: null,
    },
  });

  await upsertListingPhoto(prisma, DEMO_IDS.listingTomato, 'demo/tomato.jpg', PLACEHOLDER_PHOTOS.tomato);

  await prisma.listing.upsert({
    where: { id: DEMO_IDS.listingOnion },
    create: {
      id: DEMO_IDS.listingOnion,
      farmerProfileId: raviProfileId,
      crop: 'Onion',
      category: 'vegetables',
      variety: 'Nasik Red',
      quantity: '200.000',
      unit: Unit.quintal,
      pricePerUnit: '2200.00',
      harvestDate: dateOnly(-7),
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      description: 'Medium size red onions, good shelf life.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 41,
      interestCount: 1,
      expiresAt: daysFromNow(12),
    },
    update: {
      status: ListingStatus.active,
      expiresAt: daysFromNow(12),
      deletedAt: null,
    },
  });

  await upsertListingPhoto(prisma, DEMO_IDS.listingOnion, 'demo/onion.jpg', PLACEHOLDER_PHOTOS.onion);

  // Pending — chat demo
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderPending },
    create: {
      id: DEMO_IDS.orderPending,
      listingId: listingWheat.id,
      buyerId: buyerAman.id,
      farmerId: farmerKabir.id,
      quantity: '25.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      priceTotal: '61250.00',
      status: OrderStatus.pending,
      deliveryMode: DeliveryMode.pickup,
      notes: 'Will collect from Ludhiana yard on Friday morning.',
      logisticsStatus: LogisticsStatus.none,
      createdAt: daysAgo(1),
    },
    update: {
      status: OrderStatus.pending,
      logisticsStatus: LogisticsStatus.none,
    },
  });

  // Accepted — more chat
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderAccepted },
    create: {
      id: DEMO_IDS.orderAccepted,
      listingId: listingRice.id,
      buyerId: buyerAman.id,
      farmerId: farmerKabir.id,
      quantity: '15.000',
      unit: Unit.quintal,
      pricePerUnit: '3200.00',
      priceTotal: '48000.00',
      status: OrderStatus.accepted,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Need delivery to Delhi cold store by next week.',
      logisticsStatus: LogisticsStatus.none,
      createdAt: daysAgo(3),
    },
    update: { status: OrderStatus.accepted },
  });

  // Confirmed — logistics + escrow held
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderConfirmed },
    create: {
      id: DEMO_IDS.orderConfirmed,
      listingId: listingWheat.id,
      buyerId: buyerNeha.id,
      farmerId: farmerKabir.id,
      quantity: '40.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      priceTotal: '98000.00',
      status: OrderStatus.confirmed,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Chandigarh retail outlet — call before dispatch.',
      logisticsStatus: LogisticsStatus.in_transit,
      dispatchedAt: daysAgo(2),
      inTransitAt: daysAgo(1),
      createdAt: daysAgo(5),
    },
    update: {
      status: OrderStatus.confirmed,
      logisticsStatus: LogisticsStatus.in_transit,
    },
  });

  // Fulfilled — reviews + payment released
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderFulfilled },
    create: {
      id: DEMO_IDS.orderFulfilled,
      listingId: listingWheat.id,
      buyerId: buyerAman.id,
      farmerId: farmerKabir.id,
      quantity: '10.000',
      unit: Unit.quintal,
      pricePerUnit: '2400.00',
      priceTotal: '24000.00',
      status: OrderStatus.fulfilled,
      deliveryMode: DeliveryMode.pickup,
      notes: 'Smooth pickup last month.',
      logisticsStatus: LogisticsStatus.delivered,
      dispatchedAt: daysAgo(20),
      inTransitAt: daysAgo(19),
      logisticsDeliveredAt: daysAgo(18),
      createdAt: daysAgo(22),
    },
    update: { status: OrderStatus.fulfilled },
  });

  await seedOrderMessages(prisma, farmerKabir.id, buyerAman.id);
  await seedPayments(prisma);
  await seedReviews(prisma, farmerKabir.id, buyerAman.id);
  await seedNotifications(prisma, farmerKabir.id, buyerAman.id, buyerNeha.id, listingWheat.id);
  await seedBuyerAlerts(prisma, buyerAman.id, buyerNeha.id);
  await seedPriceTrends(prisma);

  console.info('Demo data seeded. Log in with:');
  console.info('  Farmer (Kabir): kabir.manchanda@demo.agriconnect.local');
  console.info('  Farmer (Ravi):  ravi.kumar@demo.agriconnect.local');
  console.info('  Buyer (Aman):   aman.singh@demo.agriconnect.local');
  console.info('  Buyer (Neha):   neha.verma@demo.agriconnect.local');
  console.info(`  Password:       ${demoPassword}`);
}

async function upsertListingPhoto(
  prisma: PrismaClient,
  listingId: string,
  storagePath: string,
  publicUrl: string,
): Promise<void> {
  await prisma.listingPhoto.upsert({
    where: { listingId_sortOrder: { listingId, sortOrder: 0 } },
    create: { listingId, storagePath, publicUrl, sortOrder: 0 },
    update: { storagePath, publicUrl },
  });
}

async function seedOrderMessages(
  prisma: PrismaClient,
  farmerId: string,
  buyerId: string,
): Promise<void> {
  const pendingMessages = [
    { senderId: buyerId, body: 'Namaste, is the wheat still available for 25 quintal pickup?' },
    { senderId: farmerId, body: 'Yes, freshly bagged. You can collect from Pakhowal yard.' },
    { senderId: buyerId, body: 'Great. I will bring my truck on Friday 8 AM. Please share gate pass.' },
  ];

  for (const [index, row] of pendingMessages.entries()) {
    const sentAt = daysAgo(1);
    sentAt.setHours(10 + index, 15, 0, 0);
    await prisma.message.upsert({
      where: {
        id: `f1111111-1111-4111-8111-${String(index + 1).padStart(12, '1')}`,
      },
      create: {
        id: `f1111111-1111-4111-8111-${String(index + 1).padStart(12, '1')}`,
        orderId: DEMO_IDS.orderPending,
        senderId: row.senderId,
        body: row.body,
        sentAt,
        readAt: index < 2 ? sentAt : null,
      },
      update: { body: row.body },
    });
  }

  const acceptedMessages = [
    { senderId: buyerId, body: 'Can you arrange transport to Delhi for 15 quintal basmati?' },
    { senderId: farmerId, body: 'I can load on shared truck Tuesday. ₹120/quintal freight.' },
  ];

  for (const [index, row] of acceptedMessages.entries()) {
    const sentAt = daysAgo(2);
    sentAt.setHours(14 + index, 30, 0, 0);
    await prisma.message.upsert({
      where: {
        id: `f2222222-2222-4222-8222-${String(index + 1).padStart(12, '2')}`,
      },
      create: {
        id: `f2222222-2222-4222-8222-${String(index + 1).padStart(12, '2')}`,
        orderId: DEMO_IDS.orderAccepted,
        senderId: row.senderId,
        body: row.body,
        sentAt,
      },
      update: { body: row.body },
    });
  }
}

async function seedPayments(prisma: PrismaClient): Promise<void> {
  await prisma.payment.upsert({
    where: { orderId: DEMO_IDS.orderConfirmed },
    create: {
      orderId: DEMO_IDS.orderConfirmed,
      status: PaymentStatus.held,
      amount: '98000.00',
      heldAt: daysAgo(4),
      provider: 'razorpay',
    },
    update: { status: PaymentStatus.held, amount: '98000.00' },
  });

  await prisma.payment.upsert({
    where: { orderId: DEMO_IDS.orderFulfilled },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      status: PaymentStatus.released,
      amount: '24000.00',
      heldAt: daysAgo(19),
      releasedAt: daysAgo(17),
      provider: 'razorpay',
    },
    update: { status: PaymentStatus.released },
  });
}

async function seedReviews(
  prisma: PrismaClient,
  farmerId: string,
  buyerId: string,
): Promise<void> {
  await prisma.review.upsert({
    where: {
      orderId_fromUserId: {
        orderId: DEMO_IDS.orderFulfilled,
        fromUserId: buyerId,
      },
    },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      fromUserId: buyerId,
      toUserId: farmerId,
      rating: 5,
      comment: 'Quality wheat, honest weight. Kabir was on time at the yard.',
    },
    update: { rating: 5, comment: 'Quality wheat, honest weight. Kabir was on time at the yard.' },
  });

  await prisma.review.upsert({
    where: {
      orderId_fromUserId: {
        orderId: DEMO_IDS.orderFulfilled,
        fromUserId: farmerId,
      },
    },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      fromUserId: farmerId,
      toUserId: buyerId,
      rating: 5,
      comment: 'Aman paid promptly and pickup was smooth.',
    },
    update: { rating: 5, comment: 'Aman paid promptly and pickup was smooth.' },
  });
}

async function seedNotifications(
  prisma: PrismaClient,
  farmerId: string,
  buyerAmanId: string,
  buyerNehaId: string,
  listingId: string,
): Promise<void> {
  const rows = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      userId: farmerId,
      type: NotificationType.ORDER_PLACED,
      title: 'New order on Wheat',
      body: 'Aman Singh placed an order for 25 quintal wheat.',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderPending,
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      userId: buyerAmanId,
      type: NotificationType.ORDER_STATUS_CHANGED,
      title: 'Order accepted',
      body: 'Kabir Manchanda accepted your basmati rice order.',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderAccepted,
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      userId: buyerNehaId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'New message',
      body: 'Kabir replied on your wheat order.',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderConfirmed,
    },
    {
      id: '11111111-1111-4111-8111-111111111104',
      userId: buyerAmanId,
      type: NotificationType.LISTING_PUBLISHED,
      title: 'New Wheat in Ludhiana',
      body: 'Kabir Manchanda listed Wheat at ₹2450/quintal in Ludhiana.',
      relatedEntityType: 'Listing',
      relatedEntityId: listingId,
    },
  ];

  for (const row of rows) {
    await prisma.notification.upsert({
      where: { id: row.id },
      create: row,
      update: { title: row.title, body: row.body, readAt: null },
    });
  }
}

async function seedBuyerAlerts(prisma: PrismaClient, buyerAmanId: string, buyerNehaId: string) {
  await prisma.buyerCropAlert.upsert({
    where: {
      userId_crop_state: { userId: buyerAmanId, crop: 'Wheat', state: 'Punjab' },
    },
    create: { userId: buyerAmanId, crop: 'Wheat', state: 'Punjab', enabled: true },
    update: { enabled: true },
  });

  await prisma.buyerCropAlert.upsert({
    where: {
      userId_crop_state: { userId: buyerNehaId, crop: 'Rice', state: 'Punjab' },
    },
    create: { userId: buyerNehaId, crop: 'Rice', state: 'Punjab', enabled: true },
    update: { enabled: true },
  });
}

async function seedPriceTrends(_prisma: PrismaClient): Promise<void> {
  // Agmarknet mandi prices are not seeded — they are pulled from the official govt feed
  // (data.gov.in / Agmarknet) via MANDI_SYNC_ENABLED or on-demand API calls.
}
