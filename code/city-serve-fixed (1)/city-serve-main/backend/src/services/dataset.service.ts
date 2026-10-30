import fs from "fs";
import path from "path";

export interface DatasetBusiness {
  business_name: string;
  category: string;
  subcategory: string;
  area: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  review_count: number | null;
  source: string;
  source_url: string;
  place_id: string;
  verification_status: string;
}

export interface BackendVendorDto {
  id: string;
  businessName: string;
  description: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
  };
  type: "SERVICE" | "PRODUCT" | "BOTH";
  phone: string | null;
  address: string | null;
  city: string | null;
  area?: string | null;
  subcategory?: string | null;
  latitude: number | null;
  longitude: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  website?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  placeId?: string | null;
  verificationStatus?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

let cachedRecords: DatasetBusiness[] | null = null;

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
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
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

  const [header, ...body] = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  return body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

export function getDatasetBusinesses(): DatasetBusiness[] {
  if (cachedRecords) return cachedRecords;

  const possiblePaths = [
    path.resolve(__dirname, "../../data/cityserve_patiala_seed_dataset.csv"),
    path.resolve(process.cwd(), "data/cityserve_patiala_seed_dataset.csv"),
    path.resolve(process.cwd(), "backend/data/cityserve_patiala_seed_dataset.csv"),
    "C:/Users/HP/Desktop/city-serve-fixed (1)/city-serve-main/backend/data/cityserve_patiala_seed_dataset.csv",
  ];

  let csvContent = "";
  let resolvedPath = "";
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, "utf-8");
        resolvedPath = p;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!csvContent) {
    console.warn("Dataset CSV not found in possible paths:", possiblePaths);
    return [];
  }

  console.log(`Connected CSV dataset from: ${resolvedPath}`);
  const rawRows = parseCsv(csvContent);
  cachedRecords = rawRows.map((row) => ({
    business_name: row.business_name || "",
    category: row.category || "General Services",
    subcategory: row.subcategory || "",
    area: row.area || "",
    city: row.city || "Patiala",
    address: row.address || "",
    phone: row.phone || "",
    website: row.website || "",
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    rating: row.rating ? parseFloat(row.rating) : null,
    review_count: row.review_count ? parseInt(row.review_count, 10) : null,
    source: row.source || "Google Places API (authorized access)",
    source_url: row.source_url || "",
    place_id: row.place_id || "",
    verification_status: row.verification_status || "UNVERIFIED",
  }));

  console.log(`Successfully connected ${cachedRecords.length} businesses from Patiala CSV dataset.`);
  return cachedRecords;
}

export function datasetToVendor(item: DatasetBusiness): BackendVendorDto {
  const categorySlug = item.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    id: item.place_id || encodeURIComponent(item.business_name.toLowerCase().replace(/\s+/g, "-")),
    businessName: item.business_name,
    description: item.subcategory ? `${item.subcategory} located in ${item.area || "Patiala"}.` : `Local professional service in ${item.area || "Patiala"}.`,
    categoryId: categorySlug,
    category: {
      id: categorySlug,
      name: item.category,
      slug: categorySlug,
    },
    type: "SERVICE",
    phone: item.phone || null,
    address: item.address || null,
    city: item.city || "Patiala",
    area: item.area || null,
    subcategory: item.subcategory || null,
    latitude: item.latitude,
    longitude: item.longitude,
    rating: item.rating,
    reviewCount: item.review_count,
    website: item.website || null,
    source: item.source,
    sourceUrl: item.source_url,
    placeId: item.place_id,
    verificationStatus: item.verification_status,
    isVerified: item.verification_status === "VERIFIED",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getDatasetVendors(filter?: { q?: string; category?: string; locality?: string }): BackendVendorDto[] {
  const businesses = getDatasetBusinesses();
  let vendors = businesses.map(datasetToVendor);

  if (filter?.q) {
    const q = filter.q.toLowerCase();
    vendors = vendors.filter(
      (v) =>
        v.businessName.toLowerCase().includes(q) ||
        v.category?.name.toLowerCase().includes(q) ||
        (v.subcategory && v.subcategory.toLowerCase().includes(q)) ||
        (v.area && v.area.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q))
    );
  }

  if (filter?.category && filter.category !== "all") {
    const cat = filter.category.toLowerCase();
    vendors = vendors.filter(
      (v) =>
        v.category?.name.toLowerCase() === cat ||
        v.category?.slug.toLowerCase() === cat
    );
  }

  if (filter?.locality && filter.locality !== "all") {
    const loc = filter.locality.toLowerCase();
    vendors = vendors.filter(
      (v) =>
        v.area?.toLowerCase() === loc ||
        (v.address && v.address.toLowerCase().includes(loc))
    );
  }

  return vendors;
}

export function getDatasetCategories() {
  const businesses = getDatasetBusinesses();
  const catMap = new Map<string, { id: string; name: string; slug: string; count: number; icon: string }>();

  for (const b of businesses) {
    const catName = b.category || "General Services";
    const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!catMap.has(slug)) {
      catMap.set(slug, {
        id: slug,
        name: catName,
        slug,
        count: 1,
        icon: "Wrench",
      });
    } else {
      catMap.get(slug)!.count++;
    }
  }

  return Array.from(catMap.values()).sort((a, b) => b.count - a.count);
}
