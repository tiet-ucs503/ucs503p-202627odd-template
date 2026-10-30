import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sequelize, connectDatabase } from "../config/database";
import { Category, User, Vendor, Offering } from "../models";
import { hashPassword } from "../utils/password";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h.trim()] = (r[idx] ?? "").trim()));
    return obj;
  });
}

const CATEGORY_GROUP_MAP: Record<string, { name: string; slug: string; icon: string; description: string }> = {
  Electricians: { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  Plumbers: { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  Carpenters: { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "AC Repair & Service": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "Appliance Repair": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  Painters: { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "Cleaning Services": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "Pest Control": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "RO / Water Purifier Service": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },
  "Home Renovation / Contractors": { name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, and household repairs and maintenance." },

  "Car/Bike Mechanics": { name: "Vehicle Services", slug: "vehicle-services", icon: "Car", description: "Mechanics, car wash and detailing for cars and bikes." },
  "Car Wash / Detailing": { name: "Vehicle Services", slug: "vehicle-services", icon: "Car", description: "Mechanics, car wash and detailing for cars and bikes." },

  "Beauty Parlours / Salons": { name: "Personal Care", slug: "personal-care", icon: "Sparkles", description: "Salons, grooming, tailoring and wellness services." },
  Tailors: { name: "Personal Care", slug: "personal-care", icon: "Sparkles", description: "Salons, grooming, tailoring and wellness services." },

  "Tutors / Coaching": { name: "Education", slug: "education", icon: "GraduationCap", description: "Tutors and coaching for school, college and competitive exams." },

  Photographers: { name: "Photography", slug: "photography", icon: "Camera", description: "Event, portrait and commercial photographers." },

  "Packers & Movers": { name: "Moving", slug: "moving", icon: "Truck", description: "Packing, moving and relocation services." },

  "Laundry / Dry Cleaning": { name: "Laundry & Care", slug: "laundry-care", icon: "Shirt", description: "Laundry pickup, dry cleaning and ironing services." },

  "Mobile Repair": { name: "Technology", slug: "technology", icon: "Smartphone", description: "Mobile and computer repair services." },
  "Computer/Laptop Repair": { name: "Technology", slug: "technology", icon: "Smartphone", description: "Mobile and computer repair services." },
};

function resolveCategoryGroup(csvCategory: string) {
  const known = CATEGORY_GROUP_MAP[csvCategory];
  if (known) return known;
  const slug = csvCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return { name: csvCategory, slug, icon: "Sparkles", description: `${csvCategory} services.` };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function slugifyName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export async function importBusinesses(csvPath?: string) {
  const resolvedPath = csvPath
    ? path.resolve(process.cwd(), csvPath)
    : path.resolve(__dirname, "../../data/cityserve_patiala_seed_dataset.csv");

  if (!fs.existsSync(resolvedPath)) {
    console.error(`CSV file not found at: ${resolvedPath}`);
    return { imported: 0, updated: 0, skipped: 0 };
  }

  console.log(`Reading dataset: ${resolvedPath}`);
  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const rows = parseCsv(raw);
  console.log(`Parsed ${rows.length} rows.\n`);

  const categoryCache = new Map<string, Category>();
  const placeholderPasswordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));

  let imported = 0, updated = 0, skipped = 0;

  for (const [i, row] of rows.entries()) {
    const businessName = row.business_name?.trim();
    const csvCategory = row.category?.trim();
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);

    if (!businessName || !csvCategory || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }

    const group = resolveCategoryGroup(csvCategory);
    let category = categoryCache.get(group.slug);
    if (!category) {
      const [found] = await Category.findOrCreate({
        where: { slug: group.slug },
        defaults: { name: group.name, slug: group.slug, icon: group.icon, description: group.description },
      });
      category = found;
      categoryCache.set(group.slug, found);
    }

    let vendor = await Vendor.findOne({ where: { businessName } });

    const vendorPayload = {
      businessName,
      description: `${titleCase(row.subcategory || csvCategory)} in ${row.area || row.city || "Patiala"}. Sourced from a local business dataset.`,
      categoryId: category.id,
      type: "SERVICE" as const,
      phone: row.phone?.trim() || null,
      address: row.address?.trim() || `${row.area}, ${row.city}`,
      city: row.city?.trim() || "Patiala",
      latitude: lat,
      longitude: lng,
      isVerified: false,
      isActive: true,
    };

    if (vendor) {
      await vendor.update(vendorPayload);
      updated++;
    } else {
      const emailSlug = slugifyName(businessName);
      const uniqueSuffix = crypto.randomBytes(4).toString("hex");
      const placeholderEmail = `imported.${emailSlug}.${uniqueSuffix}@unclaimed.cityserve.local`;
      const placeholderPhone = row.phone?.trim() || `IMPORTED-${uniqueSuffix}`;

      const placeholderUser = await User.create({
        name: businessName,
        email: placeholderEmail,
        phone: placeholderPhone,
        passwordHash: placeholderPasswordHash,
        role: "VENDOR",
      });

      vendor = await Vendor.create({ ...vendorPayload, userId: placeholderUser.id });
      imported++;
    }

    const serviceName = titleCase(row.subcategory || csvCategory);
    const [service] = await Offering.findOrCreate({
      where: { vendorId: vendor.id, name: serviceName, type: "SERVICE" },
      defaults: {
        vendorId: vendor.id,
        categoryId: category.id,
        type: "SERVICE",
        name: serviceName,
        description: `${serviceName} offered by ${businessName}.`,
        price: null,
        durationMinutes: 60,
        stock: 0,
        isAvailable: true,
      },
    });
  }

  console.log("=".repeat(60));
  console.log(`Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log("=".repeat(60));

  return { imported, updated, skipped };
}

// Allow running this script directly: `npm run import:businesses [path-to-csv]`
if (require.main === module) {
  (async () => {
    await connectDatabase();
    await importBusinesses(process.argv[2]);
    await sequelize.close();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
