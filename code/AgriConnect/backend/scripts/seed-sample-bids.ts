import { connectDatabase, disconnectDatabase, getPrismaClient } from '../src/config/db.js';

async function seedBids() {
  await connectDatabase();
  const prisma = getPrismaClient();

  console.log('Finding Aman Singh...');
  const buyer = await prisma.user.findFirst({
    where: { role: 'BUYER', email: 'aman.singh@demo.agriconnect.local' },
  });

  if (!buyer) {
    console.error('Buyer Aman Singh not found!');
    await disconnectDatabase();
    return;
  }

  console.log(`Found buyer: ${buyer.name} (${buyer.id})`);

  // Activate demo listings
  const demoListingIds = [
    'd1111111-1111-4111-8111-111111111111',
    'd2222222-2222-4222-8222-222222222222',
    'd3333333-3333-4333-8333-333333333333',
    'd4444444-4444-4444-8444-444444444444',
  ];

  await prisma.listing.updateMany({
    where: { id: { in: demoListingIds } },
    data: {
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
    },
  });

  const listings = await prisma.listing.findMany({
    where: { id: { in: demoListingIds } },
    include: {
      farmerProfile: {
        include: { user: true },
      },
    },
  });

  console.log(`Activated ${listings.length} demo listings: ${listings.map((l) => l.crop).join(', ')}`);

  // Clear existing bids for Aman to prevent duplicates
  await prisma.bid.deleteMany({
    where: { buyerId: buyer.id },
  });
  console.log('Cleared old bids for Aman.');

  // 1. Pending Bid on Wheat (Asking: ₹2450/quintal)
  const wheat = listings.find((l) => l.crop.toLowerCase().includes('wheat')) || listings[0];
  const wheatPrice = '2300';
  const wheatQty = '25';
  const wheatTotal = String(Number(wheatPrice) * Number(wheatQty));

  const bid1 = await prisma.bid.create({
    data: {
      listing: { connect: { id: wheat.id } },
      buyer: { connect: { id: buyer.id } },
      farmer: { connect: { id: wheat.farmerProfile.user.id } },
      pricePerUnit: wheatPrice,
      quantity: wheatQty,
      priceTotal: wheatTotal,
      unit: wheat.unit,
      status: 'pending',
      notes: 'Offering ₹2,300/quintal for 25 quintals. Pickup arranged with our own transport.',
    },
  });
  console.log(`[1] Created PENDING bid on ${wheat.crop}: ₹${wheatPrice}/${wheat.unit} (Total: ₹${wheatTotal})`);

  // 2. Countered Bid on Rice (Asking: ₹3200/quintal -> Buyer offered ₹2900 -> Farmer countered ₹3050)
  const rice = listings.find((l) => l.crop.toLowerCase().includes('rice')) || listings[1];
  const ricePrice = '2900';
  const riceCounter = '3050';
  const riceQty = '15';
  const riceTotal = String(Number(ricePrice) * Number(riceQty));

  const bid2 = await prisma.bid.create({
    data: {
      listing: { connect: { id: rice.id } },
      buyer: { connect: { id: buyer.id } },
      farmer: { connect: { id: rice.farmerProfile.user.id } },
      pricePerUnit: ricePrice,
      counterPrice: riceCounter,
      quantity: riceQty,
      priceTotal: riceTotal,
      unit: rice.unit,
      status: 'countered',
      notes: 'Initial offer ₹2,900/quintal. Farmer responded with counter-offer ₹3,050/quintal.',
    },
  });
  console.log(
    `[2] Created COUNTERED bid on ${rice.crop}: Offered ₹${ricePrice}, Farmer countered ₹${riceCounter} (Total: ₹${riceTotal})`,
  );

  // 3. Pending Bid on Onion (Asking: ₹2200/quintal -> Buyer offered ₹2100)
  const onion = listings.find((l) => l.crop.toLowerCase().includes('onion')) || listings[2];
  const onionPrice = '2100';
  const onionQty = '20';
  const onionTotal = String(Number(onionPrice) * Number(onionQty));

  const bid3 = await prisma.bid.create({
    data: {
      listing: { connect: { id: onion.id } },
      buyer: { connect: { id: buyer.id } },
      farmer: { connect: { id: onion.farmerProfile.user.id } },
      pricePerUnit: onionPrice,
      quantity: onionQty,
      priceTotal: onionTotal,
      unit: onion.unit,
      status: 'pending',
      notes: 'Need delivery to Ludhiana mandi terminal.',
    },
  });
  console.log(`[3] Created PENDING bid on ${onion.crop}: ₹${onionPrice}/${onion.unit} (Total: ₹${onionTotal})`);

  console.log('\n==========================================');
  console.log('Sample bids generated successfully for Aman Singh!');
  console.log('Now refresh http://localhost:3000/buyer');
  console.log(`Also visit listing: http://localhost:3000/listings/${wheat.id}`);
  console.log(`Also visit listing: http://localhost:3000/listings/${rice.id}`);
  console.log('==========================================\n');

  await disconnectDatabase();
}

seedBids().catch((err) => {
  console.error('Error seeding bids:', err);
  process.exit(1);
});
