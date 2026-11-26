import fs from "fs";
import path from "path";
import type { Vendor } from "@/types";

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
    path.resolve(process.cwd(), "../backend/data/cityserve_patiala_seed_dataset.csv"),
    path.resolve(process.cwd(), "data/cityserve_patiala_seed_dataset.csv"),
    path.resolve(process.cwd(), "../../backend/data/cityserve_patiala_seed_dataset.csv"),
    "C:/Users/HP/Desktop/city-serve-fixed (1)/city-serve-main/backend/data/cityserve_patiala_seed_dataset.csv",
  ];

  let csvContent = "";
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, "utf-8");
        break;
      }
    } catch {
      // try next
    }
  }

  if (!csvContent) {
    return [];
  }

  const raw = parseCsv(csvContent);
  cachedRecords = raw.map((r) => {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    const rating = parseFloat(r.rating);
    const reviews = parseInt(r.review_count, 10);

    return {
      business_name: r.business_name || "",
      category: r.category || "",
      subcategory: r.subcategory || "",
      area: r.area || "",
      city: r.city || "Patiala",
      address: r.address || "",
      phone: r.phone || "",
      website: r.website || "",
      latitude: !isNaN(lat) && lat !== 0 ? lat : null,
      longitude: !isNaN(lng) && lng !== 0 ? lng : null,
      rating: !isNaN(rating) && rating > 0 ? rating : null,
      review_count: !isNaN(reviews) && reviews >= 0 ? reviews : null,
      source: r.source || "Patiala Local Dataset",
      source_url: r.source_url || "",
      place_id: r.place_id || "",
      verification_status: r.verification_status || "UNVERIFIED",
    };
  });

  return cachedRecords;
}

// Convert a dataset business to standard Vendor interface for UI components
export function datasetToVendor(d: DatasetBusiness, index: number): Vendor {
  const slug = d.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    id: d.place_id || `biz-${index}`,
    businessName: d.business_name,
    description: `${d.subcategory || d.category} in ${d.area || d.city || "Patiala"}. Sourced from local directory.`,
    categoryId: slug,
    category: {
      id: slug,
      name: d.category,
      slug: slug,
      icon: d.category,
    },
    type: "SERVICE",
    phone: d.phone || null,
    address: d.address || (d.area ? `${d.area}, ${d.city}` : d.city),
    area: d.area || null,
    subcategory: d.subcategory || null,
    website: d.website || null,
    city: d.city || "Patiala",
    latitude: d.latitude,
    longitude: d.longitude,
    rating: d.rating,
    reviewCount: d.review_count,
    source: d.source,
    sourceUrl: d.source_url,
    placeId: d.place_id,
    verificationStatus: d.verification_status,
    isClaimed: false,
    isVerified: false,
    isActive: true,
  };
}

export function getLocalitiesWithCounts(): { name: string; count: number }[] {
  const businesses = getDatasetBusinesses();
  const counts: Record<string, number> = {};

  for (const b of businesses) {
    const loc = b.area || "Patiala Central";
    counts[loc] = (counts[loc] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
