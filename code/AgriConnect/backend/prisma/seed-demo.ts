import type { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';
import {
  BuyerType,
  DeliveryMode,
  ListingStatus,
  LogisticsStatus,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  Unit,
} from '../src/generated/prisma/client.js';

/** Stable IDs so re-seeding cleanly updates or preserves the same demo rows. */
export const DEMO_IDS = {
  // Farmers
  farmerKabir: 'c1111111-1111-4111-8111-111111111111',
  farmerRavi: 'a1111111-1111-4111-8111-111111111111',
  farmerSuresh: 'c3333333-3333-4333-8333-333333333333',
  farmerRamesh: 'c4444444-4444-4444-8444-444444444444',
  farmerManbhav: 'c5555555-5555-4555-8555-555555555555',
  farmerLakshmi: 'c6666666-6666-4666-8666-666666666666',

  // Buyers
  buyerAman: 'b1111111-1111-4111-8111-111111111111',
  buyerNeha: 'b2222222-2222-4222-8222-222222222222',
  buyerVikram: 'b3333333-3333-4333-8333-333333333333',
  buyerPriya: 'b4444444-4444-4444-8444-444444444444',

  // Listings
  listingWheat: 'd1111111-1111-4111-8111-111111111111',
  listingRice: 'd2222222-2222-4222-8222-222222222222',
  listingTomato: 'd3333333-3333-4333-8333-333333333333',
  listingOnion: 'd4444444-4444-4444-8444-444444444444',
  listingPotato: 'd5555555-5555-4555-8555-555555555555',
  listingGreenPeas: 'd6666666-6666-4666-8666-666666666666',
  listingRedChilli: 'd7777777-7777-4777-8777-777777777777',
  listingTurmeric: 'd8888888-8888-4888-8888-888888888888',
  listingCumin: 'd9999999-9999-4999-8999-999999999999',
  listingCardamom: 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  listingAlphonso: 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  listingApple: 'dccccccc-cccc-4ccc-8ccc-cccccccccccc',
  listingKinnow: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  listingChana: 'deeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  listingMoong: 'dfffffff-ffff-4fff-8fff-ffffffffffff',
  listingMustard: 'd0000001-0001-4001-8001-000000000001',
  listingGroundnut: 'd0000002-0002-4002-8002-000000000002',
  listingBajra: 'd0000003-0003-4003-8003-000000000003',

  // Orders
  orderPending: 'e1111111-1111-4111-8111-111111111111',
  orderAccepted: 'e2222222-2222-4222-8222-222222222222',
  orderConfirmed: 'e3333333-3333-4333-8333-333333333333',
  orderFulfilled: 'e4444444-4444-4444-8444-444444444444',
  orderCod: 'e5555555-5555-4555-8555-555555555555',
  orderChilli: 'e6666666-6666-4666-8666-666666666666',
} as const;

const DEMO_PASSWORD_DEFAULT = 'Demo@AgriConnect1';

/** Realistic high-resolution Unsplash agricultural photography */
const PLACEHOLDER_PHOTOS = {
  wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1200&auto=format&fit=crop&q=80',
  tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200&auto=format&fit=crop&q=80',
  onion: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=1200&auto=format&fit=crop&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=1200&auto=format&fit=crop&q=80',
  greenPeas: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=1200&auto=format&fit=crop&q=80',
  redChilli: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=1200&auto=format&fit=crop&q=80',
  turmeric: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=1200&auto=format&fit=crop&q=80',
  cumin: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=1200&auto=format&fit=crop&q=80',
  cardamom: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=1200&auto=format&fit=crop&q=80',
  alphonso: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=1200&auto=format&fit=crop&q=80',
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1200&auto=format&fit=crop&q=80',
  kinnow: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=1200&auto=format&fit=crop&q=80',
  chana: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=1200&auto=format&fit=crop&q=80',
  moong: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80',
  mustard: 'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=1200&auto=format&fit=crop&q=80',
  groundnut: 'https://images.unsplash.com/photo-1567892328021-e855519808d2?w=1200&auto=format&fit=crop&q=80',
  bajra: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&auto=format&fit=crop&q=80',
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

  // -------------------------------------------------------------
  // 1. SEED FARMERS ACROSS INDIA'S MAJOR AGRI REGIONS
  // -------------------------------------------------------------
  console.info('Seeding realistic farmers across Punjab, Maharashtra, Andhra Pradesh, Rajasthan, and Karnataka...');

  const farmerData = [
    {
      id: DEMO_IDS.farmerKabir,
      email: 'kabir.manchanda@demo.agriconnect.local',
      name: 'Kabir Manchanda',
      phone: '+91 98765 43210',
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      farmName: 'Manchanda Family Farm',
      region: 'Ludhiana',
      ratingAvg: '4.85',
    },
    {
      id: DEMO_IDS.farmerRavi,
      email: 'ravi.kumar@demo.agriconnect.local',
      name: 'Ravi Kumar',
      phone: '+91 98140 11223',
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      farmName: 'Majha Organic Produce',
      region: 'Amritsar',
      ratingAvg: '4.65',
    },
    {
      id: DEMO_IDS.farmerSuresh,
      email: 'suresh.patil@demo.agriconnect.local',
      name: 'Suresh Patil',
      phone: '+91 98220 54321',
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Niphad',
      farmName: 'Sahyadri Agro Farms',
      region: 'Nashik',
      ratingAvg: '4.90',
    },
    {
      id: DEMO_IDS.farmerRamesh,
      email: 'ramesh.reddy@demo.agriconnect.local',
      name: 'Ramesh Reddy',
      phone: '+91 94401 98765',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: 'Tenali',
      farmName: 'Guntur Spices & Organic Hub',
      region: 'Guntur',
      ratingAvg: '4.92',
    },
    {
      id: DEMO_IDS.farmerManbhav,
      email: 'manbhav.sharma@demo.agriconnect.local',
      name: 'Manbhav Sharma',
      phone: '+91 94141 67890',
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      farmName: 'Hadoti Golden Harvest',
      region: 'Kota',
      ratingAvg: '4.78',
    },
    {
      id: DEMO_IDS.farmerLakshmi,
      email: 'lakshmi.devi@demo.agriconnect.local',
      name: 'Lakshmi Devi',
      phone: '+91 94802 12345',
      state: 'Karnataka',
      district: 'Shimoga',
      village: 'Thirthahalli',
      farmName: 'Malnad Plantation & Spices',
      region: 'Western Ghats',
      ratingAvg: '4.88',
    },
  ];

  const farmerProfiles: Record<string, string> = {};

  for (const f of farmerData) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      create: {
        id: f.id,
        email: f.email,
        passwordHash: demoHash,
        name: f.name,
        role: Role.FARMER,
        phone: f.phone,
        state: f.state,
        district: f.district,
        village: f.village,
        verified: true,
        farmerProfile: {
          create: {
            farmName: f.farmName,
            region: f.region,
            ratingAvg: f.ratingAvg,
          },
        },
      },
      update: {
        passwordHash: demoHash,
        name: f.name,
        phone: f.phone,
        verified: true,
        isSuspended: false,
        deletedAt: null,
        farmerProfile: {
          upsert: {
            create: { farmName: f.farmName, region: f.region, ratingAvg: f.ratingAvg },
            update: { farmName: f.farmName, region: f.region, ratingAvg: f.ratingAvg },
          },
        },
      },
      include: { farmerProfile: true },
    });
    if (user.farmerProfile?.id) {
      farmerProfiles[f.id] = user.farmerProfile.id;
    }
  }

  // -------------------------------------------------------------
  // 2. SEED REALISTIC BUYERS (WHOLESALERS, RETAILERS, PROCESSORS)
  // -------------------------------------------------------------
  console.info('Seeding realistic buyers across Delhi, Chandigarh, Mumbai, and Bengaluru...');

  const buyerData = [
    {
      id: DEMO_IDS.buyerAman,
      email: 'aman.singh@demo.agriconnect.local',
      name: 'Aman Singh',
      phone: '+91 99100 87654',
      state: 'Delhi',
      district: 'North Delhi',
      businessName: 'Aman Agro Trading Co. (Azadpur Mandi)',
      buyerType: BuyerType.trader,
      ratingAvg: '4.90',
    },
    {
      id: DEMO_IDS.buyerNeha,
      email: 'neha.verma@demo.agriconnect.local',
      name: 'Neha Verma',
      phone: '+91 98722 34567',
      state: 'Punjab',
      district: 'Mohali',
      businessName: 'Verma Fresh Daily Retail Chain',
      buyerType: BuyerType.retailer,
      ratingAvg: '4.80',
    },
    {
      id: DEMO_IDS.buyerVikram,
      email: 'vikram.mehta@demo.agriconnect.local',
      name: 'Vikram Mehta',
      phone: '+91 98200 45678',
      state: 'Maharashtra',
      district: 'Mumbai',
      businessName: 'Apex Food Processing & Spices Ltd.',
      buyerType: BuyerType.bulk,
      ratingAvg: '4.85',
    },
    {
      id: DEMO_IDS.buyerPriya,
      email: 'priya.nair@demo.agriconnect.local',
      name: 'Priya Nair',
      phone: '+91 98450 78901',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      businessName: 'GreenRoots Organic Supermarkets',
      buyerType: BuyerType.horeca,
      ratingAvg: '4.95',
    },
  ];

  for (const b of buyerData) {
    await prisma.user.upsert({
      where: { email: b.email },
      create: {
        id: b.id,
        email: b.email,
        passwordHash: demoHash,
        name: b.name,
        role: Role.BUYER,
        phone: b.phone,
        state: b.state,
        district: b.district,
        verified: true,
        buyerProfile: {
          create: {
            businessName: b.businessName,
            buyerType: b.buyerType,
            ratingAvg: b.ratingAvg,
          },
        },
      },
      update: {
        passwordHash: demoHash,
        name: b.name,
        phone: b.phone,
        verified: true,
        isSuspended: false,
        deletedAt: null,
        buyerProfile: {
          upsert: {
            create: { businessName: b.businessName, buyerType: b.buyerType, ratingAvg: b.ratingAvg },
            update: { businessName: b.businessName, buyerType: b.buyerType, ratingAvg: b.ratingAvg },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------
  // 3. SEED 18 HIGH-QUALITY PRODUCE LISTINGS ACROSS ALL CATEGORIES
  // -------------------------------------------------------------
  console.info('Seeding 18 realistic agricultural listings with verified photos...');

  const listings = [
    // --- GRAINS ---
    {
      id: DEMO_IDS.listingWheat,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerKabir],
      crop: 'Wheat',
      category: 'grains',
      variety: 'Sharbati PBW-343',
      quantity: '450.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      harvestDate: dateOnly(-14),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'Golden sun-dried Sharbati wheat, machine-cleaned, 12% moisture certified. Stored in moisture-proof 50kg bags. Ideal for commercial flour mills.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 164,
      interestCount: 9,
      expiresAt: daysFromNow(25),
      photo: { key: 'demo/wheat.jpg', url: PLACEHOLDER_PHOTOS.wheat },
    },
    {
      id: DEMO_IDS.listingRice,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerKabir],
      crop: 'Rice',
      category: 'grains',
      variety: '1121 Pusa Basmati',
      quantity: '180.000',
      unit: Unit.quintal,
      pricePerUnit: '3400.00',
      harvestDate: dateOnly(-10),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'Extra long grain aged 1121 Pusa Basmati rice. Average grain length 8.35mm. Ideal for biryani and fine export packaging.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 112,
      interestCount: 5,
      expiresAt: daysFromNow(20),
      photo: { key: 'demo/rice.jpg', url: PLACEHOLDER_PHOTOS.rice },
    },
    {
      id: DEMO_IDS.listingBajra,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerManbhav],
      crop: 'Bajra',
      category: 'grains',
      variety: 'Hybrid Pearl Millet MPMH-17',
      quantity: '220.000',
      unit: Unit.quintal,
      pricePerUnit: '1950.00',
      harvestDate: dateOnly(-18),
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      description: 'Nutritious pearl millet (bajra). Uniform grains, high natural iron and zinc, thoroughly sifted and cleaned.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 78,
      interestCount: 3,
      expiresAt: daysFromNow(22),
      photo: { key: 'demo/bajra.jpg', url: PLACEHOLDER_PHOTOS.bajra },
    },

    // --- SPICES ---
    {
      id: DEMO_IDS.listingRedChilli,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerRamesh],
      crop: 'Red Chilli',
      category: 'spices',
      variety: 'Guntur Teja S17',
      quantity: '85.000',
      unit: Unit.quintal,
      pricePerUnit: '19800.00',
      harvestDate: dateOnly(-8),
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: 'Tenali',
      description: 'Original GI-tagged Guntur Teja (S17) stemless dry red chilli. Deep scarlet red colour, fiery pungency (SHU 75,000+), moisture strictly below 10%.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 230,
      interestCount: 14,
      expiresAt: daysFromNow(30),
      photo: { key: 'demo/red-chilli.jpg', url: PLACEHOLDER_PHOTOS.redChilli },
    },
    {
      id: DEMO_IDS.listingTurmeric,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerRamesh],
      crop: 'Turmeric',
      category: 'spices',
      variety: 'Salem Curcumin-Rich Finger',
      quantity: '95.000',
      unit: Unit.quintal,
      pricePerUnit: '14500.00',
      harvestDate: dateOnly(-12),
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: 'Tenali',
      description: 'Double-polished golden yellow turmeric fingers (haldi). Lab-certified 4.8% curcumin content, zero artificial polishing or chemical adulteration.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 145,
      interestCount: 8,
      expiresAt: daysFromNow(28),
      photo: { key: 'demo/turmeric.jpg', url: PLACEHOLDER_PHOTOS.turmeric },
    },
    {
      id: DEMO_IDS.listingCumin,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerManbhav],
      crop: 'Cumin',
      category: 'spices',
      variety: 'Unjha Machine Cleaned Jeera',
      quantity: '50.000',
      unit: Unit.quintal,
      pricePerUnit: '27500.00',
      harvestDate: dateOnly(-15),
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      description: '99.5% machine-cleaned bold brown cumin seeds (jeera). High aromatic essential oil content (3.2%), zero foreign seeds or dust.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 189,
      interestCount: 11,
      expiresAt: daysFromNow(26),
      photo: { key: 'demo/cumin.jpg', url: PLACEHOLDER_PHOTOS.cumin },
    },
    {
      id: DEMO_IDS.listingCardamom,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerLakshmi],
      crop: 'Cardamom',
      category: 'spices',
      variety: 'Malabar Extra Bold 8mm',
      quantity: '8.000',
      unit: Unit.quintal,
      pricePerUnit: '185000.00',
      harvestDate: dateOnly(-6),
      state: 'Karnataka',
      district: 'Shimoga',
      village: 'Thirthahalli',
      description: 'Fresh harvest Malabar Green Cardamom (choti elaichi). 8mm+ jumbo bold green pods, natural emerald hue, intact fragrant black seed clusters.',
      minimumOrderQuantity: '0.100',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 205,
      interestCount: 12,
      expiresAt: daysFromNow(35),
      photo: { key: 'demo/cardamom.jpg', url: PLACEHOLDER_PHOTOS.cardamom },
    },

    // --- VEGETABLES ---
    {
      id: DEMO_IDS.listingTomato,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerRavi],
      crop: 'Tomato',
      category: 'vegetables',
      variety: 'Abhinav Red Hybrid',
      quantity: '120.000',
      unit: Unit.quintal,
      pricePerUnit: '1800.00',
      harvestDate: dateOnly(-3),
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      description: 'Polyhouse farm-fresh firm red tomatoes. High lycopene, uniform size 60-70mm, thick pericarp with excellent 10-12 day transit shelf life.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 95,
      interestCount: 6,
      expiresAt: daysFromNow(7),
      photo: { key: 'demo/tomato.jpg', url: PLACEHOLDER_PHOTOS.tomato },
    },
    {
      id: DEMO_IDS.listingOnion,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerSuresh],
      crop: 'Onion',
      category: 'vegetables',
      variety: 'Nashik Garwa Red',
      quantity: '280.000',
      unit: Unit.quintal,
      pricePerUnit: '2200.00',
      harvestDate: dateOnly(-7),
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Niphad',
      description: 'Export quality Nashik Garwa red onion. Cured properly in aerated chawls, tight neck, pungent aroma, 45-55mm uniform grading.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 172,
      interestCount: 10,
      expiresAt: daysFromNow(14),
      photo: { key: 'demo/onion.jpg', url: PLACEHOLDER_PHOTOS.onion },
    },
    {
      id: DEMO_IDS.listingPotato,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerRavi],
      crop: 'Potato',
      category: 'vegetables',
      variety: 'Kufri Pukhraj',
      quantity: '350.000',
      unit: Unit.quintal,
      pricePerUnit: '1350.00',
      harvestDate: dateOnly(-10),
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      description: 'Table variety fresh Kufri Pukhraj potatoes. Washed, graded, low sugar, smooth skin, zero hollow-heart defects. Packed in 50kg mesh bags.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 64,
      interestCount: 4,
      expiresAt: daysFromNow(15),
      photo: { key: 'demo/potato.jpg', url: PLACEHOLDER_PHOTOS.potato },
    },
    {
      id: DEMO_IDS.listingGreenPeas,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerRavi],
      crop: 'Green Peas',
      category: 'vegetables',
      variety: 'Arkel Sweet',
      quantity: '75.000',
      unit: Unit.quintal,
      pricePerUnit: '3600.00',
      harvestDate: dateOnly(-2),
      state: 'Punjab',
      district: 'Amritsar',
      village: 'Ajnala',
      description: 'Crisp, sweet tender green pods harvested at dawn. 8-10 succulent grains per pod, immediate reefer or express logistics available.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 88,
      interestCount: 7,
      expiresAt: daysFromNow(6),
      photo: { key: 'demo/green-peas.jpg', url: PLACEHOLDER_PHOTOS.greenPeas },
    },

    // --- FRUITS ---
    {
      id: DEMO_IDS.listingAlphonso,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerSuresh],
      crop: 'Mango',
      category: 'fruits',
      variety: 'Devgad GI Alphonso (Hapus)',
      quantity: '60.000',
      unit: Unit.quintal,
      pricePerUnit: '5500.00',
      harvestDate: dateOnly(-4),
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Niphad',
      description: 'Naturally ripened in straw crates. Authentic GI-tagged Devgad Alphonso, golden saffron pulp, no calcium carbide or chemical ripening.',
      minimumOrderQuantity: '1.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 310,
      interestCount: 18,
      expiresAt: daysFromNow(10),
      photo: { key: 'demo/alphonso.jpg', url: PLACEHOLDER_PHOTOS.alphonso },
    },
    {
      id: DEMO_IDS.listingApple,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerKabir],
      crop: 'Apple',
      category: 'fruits',
      variety: 'Royal Delicious Shimla',
      quantity: '110.000',
      unit: Unit.quintal,
      pricePerUnit: '6900.00',
      harvestDate: dateOnly(-8),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'High-altitude crisp Royal Delicious apples from partner Himachal orchards. Crimson red blush, sweet-tangy crunch, packed in telescopic 4-layer cartons.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 156,
      interestCount: 9,
      expiresAt: daysFromNow(16),
      photo: { key: 'demo/apple.jpg', url: PLACEHOLDER_PHOTOS.apple },
    },
    {
      id: DEMO_IDS.listingKinnow,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerKabir],
      crop: 'Kinnow',
      category: 'fruits',
      variety: 'Abohar Sweet Mandarin',
      quantity: '160.000',
      unit: Unit.quintal,
      pricePerUnit: '2600.00',
      harvestDate: dateOnly(-5),
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Pakhowal',
      description: 'Juicy, glossy thin-skinned Abohar Kinnows. High juice content (48%+), thoroughly washed and food-grade waxed for premium supermarket shelves.',
      minimumOrderQuantity: '3.000',
      status: ListingStatus.active,
      perishable: true,
      viewCount: 92,
      interestCount: 4,
      expiresAt: daysFromNow(12),
      photo: { key: 'demo/kinnow.jpg', url: PLACEHOLDER_PHOTOS.kinnow },
    },

    // --- PULSES ---
    {
      id: DEMO_IDS.listingChana,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerManbhav],
      crop: 'Chana',
      category: 'pulses',
      variety: 'Desi JG-11 Brown Gram',
      quantity: '175.000',
      unit: Unit.quintal,
      pricePerUnit: '5600.00',
      harvestDate: dateOnly(-16),
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      description: 'Machine-graded desi chana (Bengal gram). Low moisture (<9.5%), high protein, excellent split yield for premium besan and dal milling.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 104,
      interestCount: 6,
      expiresAt: daysFromNow(28),
      photo: { key: 'demo/chana.jpg', url: PLACEHOLDER_PHOTOS.chana },
    },
    {
      id: DEMO_IDS.listingMoong,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerManbhav],
      crop: 'Moong',
      category: 'pulses',
      variety: 'Shiny Green Gram IPM-205',
      quantity: '110.000',
      unit: Unit.quintal,
      pricePerUnit: '7800.00',
      harvestDate: dateOnly(-14),
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      description: 'Bright green unpolished whole moong beans. Cleaned and sortex-selected, fast cooking, ideal for sprouting and whole dal packaging.',
      minimumOrderQuantity: '2.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 89,
      interestCount: 5,
      expiresAt: daysFromNow(24),
      photo: { key: 'demo/moong.jpg', url: PLACEHOLDER_PHOTOS.moong },
    },

    // --- OILSEEDS ---
    {
      id: DEMO_IDS.listingMustard,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerManbhav],
      crop: 'Mustard',
      category: 'oilseeds',
      variety: 'Pusa Bold Black Sarson',
      quantity: '240.000',
      unit: Unit.quintal,
      pricePerUnit: '5300.00',
      harvestDate: dateOnly(-20),
      state: 'Rajasthan',
      district: 'Kota',
      village: 'Ramganj Mandi',
      description: 'High oil content (41.5%) certified black mustard seeds (sarson). Low erucic acid, bold seed size, dry and clean for cold-press kachi ghani mills.',
      minimumOrderQuantity: '5.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 135,
      interestCount: 7,
      expiresAt: daysFromNow(26),
      photo: { key: 'demo/mustard.jpg', url: PLACEHOLDER_PHOTOS.mustard },
    },
    {
      id: DEMO_IDS.listingGroundnut,
      farmerProfileId: farmerProfiles[DEMO_IDS.farmerSuresh],
      crop: 'Groundnut',
      category: 'oilseeds',
      variety: 'Saurashtra Bold Pods G-20',
      quantity: '150.000',
      unit: Unit.quintal,
      pricePerUnit: '6450.00',
      harvestDate: dateOnly(-11),
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Niphad',
      description: 'Two-kernel bold groundnut pods (moongfali). Well sun-dried, count 50-55 kernels per ounce, zero aflatoxin certified.',
      minimumOrderQuantity: '3.000',
      status: ListingStatus.active,
      perishable: false,
      viewCount: 118,
      interestCount: 8,
      expiresAt: daysFromNow(21),
      photo: { key: 'demo/groundnut.jpg', url: PLACEHOLDER_PHOTOS.groundnut },
    },
  ];

  for (const item of listings) {
    const { photo, ...data } = item;
    await prisma.listing.upsert({
      where: { id: data.id },
      create: data,
      update: {
        crop: data.crop,
        category: data.category,
        variety: data.variety,
        quantity: data.quantity,
        pricePerUnit: data.pricePerUnit,
        status: data.status,
        expiresAt: data.expiresAt,
        deletedAt: null,
      },
    });

    await upsertListingPhoto(prisma, data.id, photo.key, photo.url);
  }

  // -------------------------------------------------------------
  // 4. SEED REALISTIC ORDERS & PAYMENTS (INCLUDING COD & ONLINE)
  // -------------------------------------------------------------
  console.info('Seeding realistic multi-status orders including Cash on Delivery...');

  // Order 1: Pending (Wheat, Ludhiana)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderPending },
    create: {
      id: DEMO_IDS.orderPending,
      listingId: DEMO_IDS.listingWheat,
      buyerId: DEMO_IDS.buyerAman,
      farmerId: DEMO_IDS.farmerKabir,
      quantity: '25.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      priceTotal: '61250.00',
      status: OrderStatus.pending,
      deliveryMode: DeliveryMode.pickup,
      notes: 'Will collect directly from Pakhowal yard on Friday morning.',
      logisticsStatus: LogisticsStatus.none,
      createdAt: daysAgo(1),
    },
    update: { status: OrderStatus.pending, logisticsStatus: LogisticsStatus.none },
  });

  // Order 2: Accepted (Basmati Rice, Delhi delivery)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderAccepted },
    create: {
      id: DEMO_IDS.orderAccepted,
      listingId: DEMO_IDS.listingRice,
      buyerId: DEMO_IDS.buyerAman,
      farmerId: DEMO_IDS.farmerKabir,
      quantity: '15.000',
      unit: Unit.quintal,
      pricePerUnit: '3400.00',
      priceTotal: '51000.00',
      status: OrderStatus.accepted,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Need delivery to Delhi Azadpur cold warehouse by Tuesday.',
      logisticsStatus: LogisticsStatus.none,
      createdAt: daysAgo(3),
    },
    update: { status: OrderStatus.accepted },
  });

  // Order 3: Confirmed (Wheat, Chandigarh retail delivery, In-Transit)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderConfirmed },
    create: {
      id: DEMO_IDS.orderConfirmed,
      listingId: DEMO_IDS.listingWheat,
      buyerId: DEMO_IDS.buyerNeha,
      farmerId: DEMO_IDS.farmerKabir,
      quantity: '40.000',
      unit: Unit.quintal,
      pricePerUnit: '2450.00',
      priceTotal: '98000.00',
      status: OrderStatus.confirmed,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Chandigarh retail outlet — driver should call 30 mins before arrival.',
      logisticsStatus: LogisticsStatus.in_transit,
      dispatchedAt: daysAgo(2),
      inTransitAt: daysAgo(1),
      createdAt: daysAgo(5),
    },
    update: { status: OrderStatus.confirmed, logisticsStatus: LogisticsStatus.in_transit },
  });

  // Order 4: Fulfilled (Wheat, Completed with reviews)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderFulfilled },
    create: {
      id: DEMO_IDS.orderFulfilled,
      listingId: DEMO_IDS.listingWheat,
      buyerId: DEMO_IDS.buyerAman,
      farmerId: DEMO_IDS.farmerKabir,
      quantity: '10.000',
      unit: Unit.quintal,
      pricePerUnit: '2400.00',
      priceTotal: '24000.00',
      status: OrderStatus.fulfilled,
      deliveryMode: DeliveryMode.pickup,
      notes: 'Pickup completed smoothly last month.',
      logisticsStatus: LogisticsStatus.delivered,
      dispatchedAt: daysAgo(20),
      inTransitAt: daysAgo(19),
      logisticsDeliveredAt: daysAgo(18),
      createdAt: daysAgo(22),
    },
    update: { status: OrderStatus.fulfilled },
  });

  // Order 5: Confirmed CASH ON DELIVERY (Nashik Onions -> Mumbai Wholesale)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderCod },
    create: {
      id: DEMO_IDS.orderCod,
      listingId: DEMO_IDS.listingOnion,
      buyerId: DEMO_IDS.buyerVikram,
      farmerId: DEMO_IDS.farmerSuresh,
      quantity: '50.000',
      unit: Unit.quintal,
      pricePerUnit: '2200.00',
      priceTotal: '110000.00',
      status: OrderStatus.confirmed,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Cash on Delivery confirmed. Exact payment ₹1,10,000 cash will be handed upon weighing at Vashi dock.',
      logisticsStatus: LogisticsStatus.dispatched,
      dispatchedAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    update: { status: OrderStatus.confirmed, logisticsStatus: LogisticsStatus.dispatched },
  });

  // Order 6: Accepted (Guntur Red Chilli -> Bengaluru Retail)
  await prisma.order.upsert({
    where: { id: DEMO_IDS.orderChilli },
    create: {
      id: DEMO_IDS.orderChilli,
      listingId: DEMO_IDS.listingRedChilli,
      buyerId: DEMO_IDS.buyerPriya,
      farmerId: DEMO_IDS.farmerRamesh,
      quantity: '10.000',
      unit: Unit.quintal,
      pricePerUnit: '19800.00',
      priceTotal: '198000.00',
      status: OrderStatus.accepted,
      deliveryMode: DeliveryMode.delivery,
      notes: 'Express courier delivery requested for retail organic store chain in Bengaluru.',
      logisticsStatus: LogisticsStatus.none,
      createdAt: daysAgo(1),
    },
    update: { status: OrderStatus.accepted },
  });

  // -------------------------------------------------------------
  // 5. SEED PAYMENTS
  // -------------------------------------------------------------
  console.info('Seeding payments with Razorpay escrow and Cash on Delivery records...');

  // Escrow held online
  await prisma.payment.upsert({
    where: { orderId: DEMO_IDS.orderConfirmed },
    create: {
      orderId: DEMO_IDS.orderConfirmed,
      status: PaymentStatus.held,
      method: PaymentMethod.upi,
      amount: '98000.00',
      heldAt: daysAgo(4),
      provider: 'razorpay',
      providerRef: 'pay_demo_escrow_98000',
    },
    update: { status: PaymentStatus.held, amount: '98000.00' },
  });

  // Released online
  await prisma.payment.upsert({
    where: { orderId: DEMO_IDS.orderFulfilled },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      status: PaymentStatus.released,
      method: PaymentMethod.netbanking,
      amount: '24000.00',
      heldAt: daysAgo(19),
      releasedAt: daysAgo(17),
      provider: 'razorpay',
      providerRef: 'pay_demo_released_24000',
    },
    update: { status: PaymentStatus.released },
  });

  // Cash on Delivery Payment Record
  await prisma.payment.upsert({
    where: { orderId: DEMO_IDS.orderCod },
    create: {
      orderId: DEMO_IDS.orderCod,
      status: PaymentStatus.pending,
      method: PaymentMethod.cod,
      amount: '110000.00',
      provider: 'cod',
      providerRef: 'cod_order_110000',
    },
    update: { status: PaymentStatus.pending, method: PaymentMethod.cod },
  });

  // -------------------------------------------------------------
  // 6. SEED REVIEWS & MESSAGES
  // -------------------------------------------------------------
  await seedOrderMessages(prisma);
  await seedReviews(prisma);
  await seedBuyerAlerts(prisma);
  await seedNotifications(prisma);

  console.info('\n=============================================================');
  console.info('DEMO DATA SUCCESSFULLY SEEDED WITH 18 RICH REALISTIC CROPS!');
  console.info('=============================================================');
  console.info('Log in with demo accounts (Password: ' + demoPassword + '):');
  console.info('  Farmers:');
  console.info('    • Kabir Manchanda (Punjab):       kabir.manchanda@demo.agriconnect.local');
  console.info('    • Ravi Kumar (Punjab):            ravi.kumar@demo.agriconnect.local');
  console.info('    • Suresh Patil (Maharashtra):     suresh.patil@demo.agriconnect.local');
  console.info('    • Ramesh Reddy (Andhra Pradesh):  ramesh.reddy@demo.agriconnect.local');
  console.info('    • Manbhav Sharma (Rajasthan):     manbhav.sharma@demo.agriconnect.local');
  console.info('    • Lakshmi Devi (Karnataka):       lakshmi.devi@demo.agriconnect.local');
  console.info('  Buyers:');
  console.info('    • Aman Singh (Delhi Wholesale):   aman.singh@demo.agriconnect.local');
  console.info('    • Neha Verma (Punjab Retail):     neha.verma@demo.agriconnect.local');
  console.info('    • Vikram Mehta (Mumbai Bulk):     vikram.mehta@demo.agriconnect.local');
  console.info('    • Priya Nair (Bengaluru Super):   priya.nair@demo.agriconnect.local');
  console.info('=============================================================\n');
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

async function seedOrderMessages(prisma: PrismaClient): Promise<void> {
  const pendingMessages = [
    { senderId: DEMO_IDS.buyerAman, body: 'Namaste Kabir ji, is the wheat freshly bagged for 25 quintal pickup?' },
    { senderId: DEMO_IDS.farmerKabir, body: 'Haan ji Aman bhai, freshly bagged in 50kg moisture-proof sacks at Pakhowal yard.' },
    { senderId: DEMO_IDS.buyerAman, body: 'Great. I will bring my truck on Friday 8 AM. Please keep the gate pass ready.' },
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

  const codMessages = [
    { senderId: DEMO_IDS.buyerVikram, body: 'Hello Suresh ji, we have confirmed Cash on Delivery for the 50 quintals of Nashik Red Onions.' },
    { senderId: DEMO_IDS.farmerSuresh, body: 'Namaskar Vikram ji. Truck loaded and dispatched today morning. Driver has the weighbridge slip.' },
    { senderId: DEMO_IDS.buyerVikram, body: 'Perfect. Exact cash ₹1,10,000 will be paid at our Vashi dock after quality check.' },
  ];

  for (const [index, row] of codMessages.entries()) {
    const sentAt = daysAgo(1);
    sentAt.setHours(12 + index, 30, 0, 0);
    await prisma.message.upsert({
      where: {
        id: `f3333333-3333-4333-8333-${String(index + 1).padStart(12, '3')}`,
      },
      create: {
        id: `f3333333-3333-4333-8333-${String(index + 1).padStart(12, '3')}`,
        orderId: DEMO_IDS.orderCod,
        senderId: row.senderId,
        body: row.body,
        sentAt,
      },
      update: { body: row.body },
    });
  }
}

async function seedReviews(prisma: PrismaClient): Promise<void> {
  await prisma.review.upsert({
    where: {
      orderId_fromUserId: {
        orderId: DEMO_IDS.orderFulfilled,
        fromUserId: DEMO_IDS.buyerAman,
      },
    },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      fromUserId: DEMO_IDS.buyerAman,
      toUserId: DEMO_IDS.farmerKabir,
      rating: 5,
      comment: 'Top quality Sharbati wheat, accurate weight and moisture. Kabir was helpful at the yard.',
    },
    update: { rating: 5, comment: 'Top quality Sharbati wheat, accurate weight and moisture. Kabir was helpful at the yard.' },
  });

  await prisma.review.upsert({
    where: {
      orderId_fromUserId: {
        orderId: DEMO_IDS.orderFulfilled,
        fromUserId: DEMO_IDS.farmerKabir,
      },
    },
    create: {
      orderId: DEMO_IDS.orderFulfilled,
      fromUserId: DEMO_IDS.farmerKabir,
      toUserId: DEMO_IDS.buyerAman,
      rating: 5,
      comment: 'Aman is a reliable buyer. Truck arrived on time and payment release was immediate.',
    },
    update: { rating: 5, comment: 'Aman is a reliable buyer. Truck arrived on time and payment release was immediate.' },
  });
}

async function seedBuyerAlerts(prisma: PrismaClient): Promise<void> {
  const alerts = [
    { userId: DEMO_IDS.buyerAman, crop: 'Wheat', state: 'Punjab' },
    { userId: DEMO_IDS.buyerAman, crop: 'Rice', state: 'Punjab' },
    { userId: DEMO_IDS.buyerNeha, crop: 'Tomato', state: 'Punjab' },
    { userId: DEMO_IDS.buyerNeha, crop: 'Onion', state: 'Maharashtra' },
    { userId: DEMO_IDS.buyerVikram, crop: 'Red Chilli', state: 'Andhra Pradesh' },
    { userId: DEMO_IDS.buyerVikram, crop: 'Turmeric', state: 'Andhra Pradesh' },
    { userId: DEMO_IDS.buyerPriya, crop: 'Cardamom', state: 'Karnataka' },
    { userId: DEMO_IDS.buyerPriya, crop: 'Mango', state: 'Maharashtra' },
  ];

  for (const a of alerts) {
    await prisma.buyerCropAlert.upsert({
      where: {
        userId_crop_state: { userId: a.userId, crop: a.crop, state: a.state },
      },
      create: { userId: a.userId, crop: a.crop, state: a.state, enabled: true },
      update: { enabled: true },
    });
  }
}

async function seedNotifications(prisma: PrismaClient): Promise<void> {
  const rows = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      userId: DEMO_IDS.farmerKabir,
      type: NotificationType.ORDER_PLACED,
      title: 'New order on Sharbati Wheat',
      body: 'Aman Singh placed an order for 25 quintal wheat.',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderPending,
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      userId: DEMO_IDS.buyerAman,
      type: NotificationType.ORDER_STATUS_CHANGED,
      title: 'Order accepted',
      body: 'Kabir Manchanda accepted your 1121 Pusa Basmati rice order.',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderAccepted,
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      userId: DEMO_IDS.buyerVikram,
      type: NotificationType.ORDER_STATUS_CHANGED,
      title: 'Cash on Delivery order confirmed',
      body: 'Suresh Patil dispatched 50 quintal Nashik Red Onions (COD: ₹1,10,000).',
      relatedEntityType: 'Order',
      relatedEntityId: DEMO_IDS.orderCod,
    },
    {
      id: '11111111-1111-4111-8111-111111111104',
      userId: DEMO_IDS.buyerAman,
      type: NotificationType.LISTING_PUBLISHED,
      title: 'New Wheat in Ludhiana',
      body: 'Kabir Manchanda listed Sharbati Wheat at ₹2450/quintal in Ludhiana.',
      relatedEntityType: 'Listing',
      relatedEntityId: DEMO_IDS.listingWheat,
    },
    {
      id: '11111111-1111-4111-8111-111111111105',
      userId: DEMO_IDS.buyerVikram,
      type: NotificationType.LISTING_PUBLISHED,
      title: 'New Guntur Teja Chilli in Tenali',
      body: 'Ramesh Reddy listed Guntur Teja Chilli (S17) at ₹19800/quintal.',
      relatedEntityType: 'Listing',
      relatedEntityId: DEMO_IDS.listingRedChilli,
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
