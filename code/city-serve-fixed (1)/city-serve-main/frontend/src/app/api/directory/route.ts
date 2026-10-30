import { NextRequest, NextResponse } from "next/server";
import { getDatasetBusinesses, datasetToVendor } from "@/lib/dataset";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const q = searchParams.get("q")?.toLowerCase();
    const category = searchParams.get("category");
    const locality = searchParams.get("locality");

    const businesses = getDatasetBusinesses();
    const vendors = businesses.map(datasetToVendor);

    if (id) {
      const found = vendors.find((v) => v.id === id || v.placeId === id);
      if (found) return NextResponse.json(found);
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    let filtered = vendors;

    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.businessName.toLowerCase().includes(q) ||
          v.category?.name.toLowerCase().includes(q) ||
          (v.subcategory && v.subcategory.toLowerCase().includes(q)) ||
          (v.area && v.area.toLowerCase().includes(q)) ||
          (v.address && v.address.toLowerCase().includes(q))
      );
    }

    if (category && category !== "ALL") {
      filtered = filtered.filter(
        (v) =>
          v.categoryId === category ||
          v.category?.slug === category ||
          v.category?.name.toLowerCase() === category.toLowerCase()
      );
    }

    if (locality && locality !== "All Localities") {
      filtered = filtered.filter((v) =>
        v.area?.toLowerCase().includes(locality.toLowerCase()) ||
        v.address?.toLowerCase().includes(locality.toLowerCase())
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Directory API error:", error);
    return NextResponse.json({ error: "Failed to load directory listings" }, { status: 500 });
  }
}
