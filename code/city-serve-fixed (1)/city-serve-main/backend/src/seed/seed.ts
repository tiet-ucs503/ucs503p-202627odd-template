import { sequelize, connectDatabase } from "../config/database";
import { Category, User, Vendor, Offering, Order, Review } from "../models";
import { hashPassword } from "../utils/password";
import { importBusinesses } from "../scripts/importBusinesses";

// ─── Category definitions ───────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { name: "Fresh & Daily Essentials", slug: "fresh-daily-essentials", icon: "Milk", description: "Daily grocery staples delivered fresh." },
  { name: "Food & Home Kitchen", slug: "food-home-kitchen", icon: "UtensilsCrossed", description: "Home-cooked meals, tiffins and bakery items." },
  { name: "Laundry & Dry Cleaning", slug: "laundry-dry-cleaning", icon: "WashingMachine", description: "Pickup & drop laundry, ironing, and dry cleaning." },
  { name: "Electrical Services", slug: "electrical-services", icon: "Zap", description: "Certified electricians for repairs & installations." },
  { name: "Plumbing & Repairs", slug: "plumbing-repairs", icon: "Wrench", description: "Expert plumbers for leaks, fittings & pipe work." },
  { name: "Tutoring & Coaching", slug: "tutoring-coaching", icon: "GraduationCap", description: "Subject tutors, coaching & skill courses." },
];

// ─── Vendor Definitions by Category ─────────────────────────────────────────

const VENDORS: { slug: string; vendors: { businessName: string; description: string; type: "PRODUCT" | "SERVICE" | "BOTH" }[] }[] = [
  {
    slug: "fresh-daily-essentials",
    vendors: [
      { businessName: "GreenBasket Farms", description: "Farm-fresh vegetables and fruits, hand-picked daily and delivered to your doorstep.", type: "PRODUCT" },
      { businessName: "PureSpring Dairy Co.", description: "Buffalo milk, curd and paneer with strict quality checks and cold-chain delivery.", type: "PRODUCT" },
    ],
  },
  {
    slug: "food-home-kitchen",
    vendors: [
      { businessName: "HomeBite Kitchen", description: "Home-style North Indian meals cooked fresh daily, subscription-friendly.", type: "PRODUCT" },
      { businessName: "Campus Tiffin Co.", description: "Affordable, healthy tiffin service built specifically for Thapar students.", type: "PRODUCT" },
    ],
  },
  {
    slug: "laundry-dry-cleaning",
    vendors: [
      { businessName: "CleanWave Laundry", description: "Pickup & drop laundry & dry-cleaning service. 24-hr turnaround for hostel residents.", type: "BOTH" },
    ],
  },
  {
    slug: "electrical-services",
    vendors: [
      { businessName: "SparkFix Electricals", description: "Certified electricians for wiring, appliance repair, fan & AC installation.", type: "SERVICE" },
    ],
  },
  {
    slug: "plumbing-repairs",
    vendors: [
      { businessName: "PipeRight Plumbers", description: "Expert plumbers for leak fixes, tap fittings, bathroom installation & pipe work.", type: "SERVICE" },
    ],
  },
  {
    slug: "tutoring-coaching",
    vendors: [
      { businessName: "Mentora Coaching Hub", description: "Online & offline tutoring for Thapar UG courses — Maths, Physics, Programming & more.", type: "SERVICE" },
    ],
  },
];

// ─── Offering Templates by Category ─────────────────────────────────────────

type OfferingTemplate = {
  name: string;
  type: "PRODUCT" | "SERVICE";
  price: number;
  unit?: string;
  stock?: number;
  durationMinutes?: number;
  description: string;
};

const OFFERINGS_BY_SLUG: Record<string, OfferingTemplate[]> = {
  "fresh-daily-essentials": [
    { name: "Farm-Fresh Curd", type: "PRODUCT", price: 45, unit: "500g", stock: 100, description: "Thick, creamy set curd made from buffalo milk." },
    { name: "Homestyle Paneer", type: "PRODUCT", price: 90, unit: "250g", stock: 60, description: "Soft, freshly made paneer from local dairy farms." },
    { name: "Farm Eggs", type: "PRODUCT", price: 60, unit: "6 pcs", stock: 200, description: "Farm-fresh desi eggs, collected same day." },
    { name: "Seasonal Fruit Basket", type: "PRODUCT", price: 120, unit: "kg", stock: 50, description: "Hand-picked local seasonal fruits." },
    { name: "Mixed Vegetable Box", type: "PRODUCT", price: 65, unit: "kg", stock: 80, description: "Assorted fresh vegetables delivered from local farms." },
  ],
  "food-home-kitchen": [
    { name: "Veg Thali Tiffin", type: "PRODUCT", price: 120, unit: "meal", stock: 50, description: "Wholesome 5-item veg thali: dal, sabzi, roti, rice, salad." },
    { name: "Weekly Tiffin Subscription", type: "PRODUCT", price: 700, unit: "week", stock: 30, description: "5-day meal subscription with variety each day." },
    { name: "Dal Makhani + Rice Combo", type: "PRODUCT", price: 110, unit: "meal", stock: 40, description: "Slow-cooked dal makhani with steam rice." },
    { name: "Special Paneer Butter Masala Combo", type: "PRODUCT", price: 140, unit: "meal", stock: 35, description: "Rich paneer butter masala with 3 phulkas." },
  ],
  "laundry-dry-cleaning": [
    { name: "Regular Wash & Fold", type: "PRODUCT", price: 50, unit: "kg", stock: 200, description: "Machine wash, dry & fold. Delivered within 24 hours." },
    { name: "Iron & Press Service", type: "PRODUCT", price: 30, unit: "per item", stock: 500, description: "Crisp professional ironing per garment." },
    { name: "Dry Clean (Formal Wear)", type: "SERVICE", price: 150, durationMinutes: 1440, description: "Dry-clean and press for formals, blazers & sarees." },
    { name: "Blanket / Comforter Wash", type: "PRODUCT", price: 180, unit: "piece", stock: 30, description: "Deep clean wash for blankets and thick comforters." },
  ],
  "electrical-services": [
    { name: "Fan Installation / Repair", type: "SERVICE", price: 200, durationMinutes: 60, description: "Installation or repair of ceiling/wall fan." },
    { name: "Electrical Wiring Repair", type: "SERVICE", price: 350, durationMinutes: 90, description: "Diagnose and fix faulty wiring, switchboards & sockets." },
    { name: "AC Installation", type: "SERVICE", price: 800, durationMinutes: 120, description: "Split or window AC installation by certified technician." },
    { name: "MCB / Fuse Repair", type: "SERVICE", price: 150, durationMinutes: 45, description: "Main circuit breaker and fuse box diagnostics & fixes." },
  ],
  "plumbing-repairs": [
    { name: "Tap / Faucet Repair", type: "SERVICE", price: 150, durationMinutes: 30, description: "Fix dripping or broken taps and faucets." },
    { name: "Pipe Leak Fix", type: "SERVICE", price: 250, durationMinutes: 60, description: "Locate and seal leaking pipes without major breakage." },
    { name: "Bathroom Fitting Installation", type: "SERVICE", price: 600, durationMinutes: 120, description: "Install new shower, seat or basin fittings." },
    { name: "Drain Cleaning", type: "SERVICE", price: 300, durationMinutes: 45, description: "Clear blocked drains and kitchen/bathroom pipes." },
  ],
  "tutoring-coaching": [
    { name: "Maths Tutoring (1 hr session)", type: "SERVICE", price: 300, durationMinutes: 60, description: "1-on-1 tutoring for engineering maths, calculus & algebra." },
    { name: "Physics / EMF Session", type: "SERVICE", price: 300, durationMinutes: 60, description: "Engineering physics coaching for Thapar curriculum." },
    { name: "C++ / DSA Programming Help", type: "SERVICE", price: 350, durationMinutes: 60, description: "Hands-on coding help for DSA assignments and lab work." },
    { name: "Monthly Group Tuition Pack", type: "SERVICE", price: 1500, durationMinutes: 60, description: "4-week group sessions (3/week) for core UG subjects." },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pastDate(daysAgoMax: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgoMax));
  return d;
}

const RANDOM_REVIEWS = [
  "Really happy with the service! Fast and reliable.",
  "Great quality. Will order again.",
  "Excellent experience, highly recommended.",
  "Delivered on time. Very professional.",
  "Good value for money. 5 stars!",
  "The best in the area. Superb quality.",
  "Very courteous and efficient.",
  "Loved it. My go-to from now on!",
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding CityServe demo data (6-category schema)...\n");
  await connectDatabase();

  // Clear all tables in dependency order
  await Review.destroy({ where: {} });
  await Order.destroy({ where: {} });
  await Offering.destroy({ where: {} });
  await Vendor.destroy({ where: {} });
  await User.destroy({ where: {} });
  await Category.destroy({ where: {} });

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryMap: Record<string, Category> = {};
  for (const def of CATEGORY_DEFS) {
    const [cat] = await Category.findOrCreate({ where: { slug: def.slug }, defaults: def });
    categoryMap[def.slug] = cat;
    console.log(`  ✓ Category: ${def.name}`);
  }

  // ── Admin user ────────────────────────────────────────────────────────────
  await User.create({
    name: "CityServe Admin",
    email: "admin@cityserve.demo",
    phone: "9999900000",
    passwordHash: await hashPassword("Admin@123"),
    role: "ADMIN",
    address: null,
    city: null,
  });

  // ── Demo customer ─────────────────────────────────────────────────────────
  const demoCustomer = await User.create({
    name: "Rohan Sharma",
    email: "student@thapar.demo",
    phone: "9876543210",
    passwordHash: await hashPassword("Student@123"),
    role: "CUSTOMER",
    address: "Hostel J, Room 212, Thapar University, Patiala",
    city: "Patiala",
  });

  // ── Vendors & Offerings ───────────────────────────────────────────────────
  const vendorPasswordHash = await hashPassword("Vendor@123");
  const allVendors: Vendor[] = [];
  const allOfferings: Offering[] = [];
  let firstVendorEmail = "";

  for (const group of VENDORS) {
    const category = categoryMap[group.slug];
    const templates = OFFERINGS_BY_SLUG[group.slug] ?? [];

    for (const def of group.vendors) {
      const emailSlug = def.businessName.toLowerCase().replace(/[^a-z0-9]+/g, ".");
      const email = `${emailSlug}@cityserve.demo`;
      if (!firstVendorEmail) firstVendorEmail = email;

      const ownerUser = await User.create({
        name: `${def.businessName} Owner`,
        email,
        phone: `97${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`,
        passwordHash: vendorPasswordHash,
        role: "VENDOR",
        address: "Model Town, Patiala",
        city: "Patiala",
      });

      const vendor = await Vendor.create({
        userId: ownerUser.id,
        businessName: def.businessName,
        description: def.description,
        categoryId: category.id,
        type: def.type,
        phone: `0175-${Math.floor(2000000 + Math.random() * 7999999)}`,
        address: "Model Town, Patiala",
        city: "Patiala",
        isVerified: true,
        isActive: true,
      });

      allVendors.push(vendor);
      console.log(`  ✓ Vendor: ${def.businessName} (${def.type})`);

      for (const t of templates) {
        const offering = await Offering.create({
          vendorId: vendor.id,
          categoryId: category.id,
          type: t.type,
          name: t.name,
          description: t.description,
          price: t.price,
          unit: t.unit ?? null,
          stock: t.stock ?? 0,
          durationMinutes: t.durationMinutes ?? 0,
          isAvailable: true,
        });
        allOfferings.push(offering);
      }
    }
  }

  // ── Demo Orders & Reviews ─────────────────────────────────────────────────
  const STATUSES: Array<"PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED"> =
    ["COMPLETED", "COMPLETED", "COMPLETED", "APPROVED", "PENDING", "CANCELLED"];

  for (let i = 0; i < 20; i++) {
    const vendor = allVendors[Math.floor(Math.random() * allVendors.length)];
    const offerings = allOfferings.filter((o) => o.vendorId === vendor.id);
    if (!offerings.length) continue;

    const offering = offerings[Math.floor(Math.random() * offerings.length)];
    const quantity = offering.type === "PRODUCT" ? Math.ceil(Math.random() * 3) : 1;
    const price = offering.price ?? 0;
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const createdAt = pastDate(45);

    const order = await Order.create({
      orderNumber: `ORD-${Date.now().toString().slice(-6)}-${i}`,
      customerId: demoCustomer.id,
      vendorId: vendor.id,
      offeringId: offering.id,
      quantity,
      type: offering.type,
      price,
      totalAmount: price * quantity,
      address: demoCustomer.address,
      scheduledAt: offering.type === "SERVICE" ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null,
      status,
      paymentStatus: status === "COMPLETED" ? "PAID" : "PENDING",
      completedAt: status === "COMPLETED" ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
    });

    // 70% chance of review on completed orders
    if (status === "COMPLETED" && Math.random() < 0.7) {
      await Review.create({
        customerId: demoCustomer.id,
        vendorId: vendor.id,
        offeringId: offering.id,
        orderId: order.id,
        rating: 4 + Math.round(Math.random()),
        comment: RANDOM_REVIEWS[Math.floor(Math.random() * RANDOM_REVIEWS.length)],
        createdAt: new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
    }
  }

  console.log("\n📦  Importing the real Patiala business dataset (155 businesses)...\n");
  await importBusinesses();

  console.log("\n✅  Demo seed complete.\n");
  console.log("🔑  Demo credentials:");
  console.log("    Admin:    admin@cityserve.demo    / Admin@123");
  console.log("    Customer: student@thapar.demo     / Student@123");
  console.log(`    Vendor:   ${firstVendorEmail.padEnd(34)} / Vendor@123`);

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
