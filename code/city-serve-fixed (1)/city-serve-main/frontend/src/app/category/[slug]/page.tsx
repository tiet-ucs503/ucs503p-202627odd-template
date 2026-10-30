"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { PackageSearch, ArrowLeft, Search, Building2, Wrench, Package } from "lucide-react";
import { api } from "@/lib/api";
import { getCategoryIcon } from "@/lib/icons";
import ProductCard from "@/components/ProductCard";
import ServiceCard from "@/components/ServiceCard";
import VendorCard from "@/components/VendorCard";
import { CardSkeletonGrid } from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import type { Category, Offering, Vendor } from "@/types";

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Offering[]>([]);
  const [services, setServices] = useState<Offering[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"businesses" | "offerings">("businesses");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategoryData() {
      setLoading(true);
      try {
        const [catRes, prodRes, svcRes, vendorRes] = await Promise.allSettled([
          api.get<Category>(`/categories/${params.slug}`),
          api.get<Offering[]>(`/catalog/products?categorySlug=${params.slug}`),
          api.get<Offering[]>(`/catalog/services?categorySlug=${params.slug}`),
          api.get<Vendor[]>(`/vendors`),
        ]);

        if (catRes.status === "fulfilled" && catRes.value) {
          setCategory(catRes.value);
        } else {
          // Construct fallback category
          const title = params.slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          setCategory({ id: params.slug, slug: params.slug, name: title, icon: title });
        }

        if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value)) {
          setProducts(prodRes.value);
        }
        if (svcRes.status === "fulfilled" && Array.isArray(svcRes.value)) {
          setServices(svcRes.value);
        }

        let fetchedVendors: Vendor[] = [];
        if (vendorRes.status === "fulfilled" && Array.isArray(vendorRes.value) && vendorRes.value.length > 0) {
          fetchedVendors = vendorRes.value.filter(
            (v) => v.categoryId === params.slug || v.category?.slug === params.slug
          );
        }

        // Also fetch from directory API to ensure full 155 record dataset visibility
        try {
          const dirRes = await fetch(`/api/directory?category=${params.slug}`);
          if (dirRes.ok) {
            const dirVendors: Vendor[] = await dirRes.json();
            if (dirVendors.length > fetchedVendors.length) {
              fetchedVendors = dirVendors;
            }
          }
        } catch {
          // ignore
        }

        setVendors(fetchedVendors);

        // If offerings exist but businesses don't, default tab to offerings
        if (fetchedVendors.length === 0 && (products.length > 0 || services.length > 0)) {
          setTab("offerings");
        }
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    }

    loadCategoryData();
  }, [params.slug, products.length, services.length]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase().trim();
    return vendors.filter(
      (v) =>
        v.businessName.toLowerCase().includes(q) ||
        (v.subcategory && v.subcategory.toLowerCase().includes(q)) ||
        (v.area && v.area.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q))
    );
  }, [vendors, searchQuery]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <CardSkeletonGrid count={8} />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={PackageSearch}
          title="Category not found"
          description="The requested category does not exist in our directory."
          action={
            <Link href="/explore">
              <Button size="sm">Browse Directory</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const Icon = getCategoryIcon(category.icon || category.name);
  const totalOfferings = products.length + services.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft size={14} /> Back to Directory
        </Link>
      </div>

      {/* Category Header */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary shadow-subtle border border-border/60">
            <Icon size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">{category.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              {category.description || `Browse trusted ${category.name.toLowerCase()} businesses and services around Patiala.`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block text-xs font-semibold text-primary bg-secondary px-3 py-1.5 rounded-full border border-border/60">
            {vendors.length} Verified Listings
          </span>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        {/* Tab switch */}
        <div className="flex rounded-xl bg-muted p-1 border border-border/60 w-fit">
          <button
            onClick={() => setTab("businesses")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "businesses" ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 size={13} /> Businesses ({vendors.length})
          </button>
          <button
            onClick={() => setTab("offerings")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "offerings" ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench size={13} /> Direct Bookings ({totalOfferings})
          </button>
        </div>

        {/* In-category search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs shadow-subtle focus-within:ring-2 focus-within:ring-primary/20 w-full sm:w-72">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${category.name}...`}
            className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Content Rendering */}
      <div>
        {tab === "businesses" ? (
          filteredVendors.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={`No businesses found in ${category.name}`}
              description="Try adjusting your filter or check back later as new local listings are imported."
              action={
                <Link href="/explore">
                  <Button size="sm">Explore All Categories</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )
        ) : totalOfferings === 0 ? (
          <EmptyState
            icon={Package}
            title="No direct service offerings listed yet"
            description="Businesses in this category can be contacted directly via phone or location in the Businesses tab."
            action={
              <Button size="sm" onClick={() => setTab("businesses")}>
                View Directory Listings
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
