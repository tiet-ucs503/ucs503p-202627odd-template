"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  SlidersHorizontal,
  Package,
  Wrench,
  Building2,
  X,
  MapPin,
  Map as MapIcon,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import ServiceCard from "@/components/ServiceCard";
import VendorCard from "@/components/VendorCard";
import DirectoryMap from "@/components/DirectoryMap";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeletonGrid } from "@/components/ui/CardSkeleton";
import Button from "@/components/ui/Button";
import type { Offering, Category, Vendor } from "@/types";

type DiscoveryTab = "BUSINESS" | "SERVICE" | "PRODUCT";
type SortOption = "DEFAULT" | "RATING_DESC" | "REVIEWS_DESC" | "NAME_ASC";

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") as DiscoveryTab) || (searchParams.get("type") as DiscoveryTab) || "BUSINESS";
  const [tab, setTab] = useState<DiscoveryTab>(
    initialTab === "PRODUCT" || initialTab === "SERVICE" ? initialTab : "BUSINESS"
  );

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") ?? "ALL");
  const [selectedLocality, setSelectedLocality] = useState(searchParams.get("locality") ?? "ALL");
  const [sort, setSort] = useState<SortOption>("DEFAULT");
  const [showMap, setShowMap] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Load categories and initial vendors from directory
  useEffect(() => {
    // 1. Categories
    api
      .get<Category[]>("/categories")
      .then((cats) => {
        if (Array.isArray(cats) && cats.length > 0) setCategories(cats);
        else fetchCategoriesFromLocal();
      })
      .catch(() => fetchCategoriesFromLocal());

    // 2. Vendors from directory / backend
    fetchVendors();

    async function fetchCategoriesFromLocal() {
      try {
        const res = await fetch("/api/directory");
        const data: Vendor[] = await res.json();
        const map = new Map<string, Category>();
        data.forEach((v) => {
          if (v.category) map.set(v.category.slug, v.category);
        });
        setCategories(Array.from(map.values()));
      } catch {
        // fallback handled
      }
    }
  }, []);

  async function fetchVendors() {
    setLoading(true);
    try {
      // First attempt backend /api/vendors
      const data = await api.get<Vendor[]>("/vendors");
      if (Array.isArray(data) && data.length > 0) {
        setVendors(data);
      } else {
        await fetchDirectoryVendors();
      }
    } catch {
      await fetchDirectoryVendors();
    } finally {
      setLoading(false);
    }
  }

  async function fetchDirectoryVendors() {
    try {
      const res = await fetch("/api/directory");
      const data = await res.json();
      if (Array.isArray(data)) setVendors(data);
    } catch {
      setVendors([]);
    }
  }

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load offerings when in SERVICE or PRODUCT tab
  useEffect(() => {
    if (tab === "BUSINESS") return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (debouncedQ) qs.set("q", debouncedQ);
    if (selectedCategory !== "ALL") qs.set("categorySlug", selectedCategory);

    const endpoint = tab === "PRODUCT" ? "/catalog/products" : "/catalog/services";
    api
      .get<Offering[]>(`${endpoint}?${qs.toString()}`)
      .then((data) => setOfferings(Array.isArray(data) ? data : []))
      .catch(() => setOfferings([]))
      .finally(() => setLoading(false));
  }, [debouncedQ, tab, selectedCategory]);

  // Synchronize URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (tab !== "BUSINESS") params.set("tab", tab);
    if (selectedCategory !== "ALL") params.set("category", selectedCategory);
    if (selectedLocality !== "ALL") params.set("locality", selectedLocality);
    router.replace(`/explore?${params.toString()}`, { scroll: false });
  }, [debouncedQ, tab, selectedCategory, selectedLocality, router]);

  // Extract all distinct localities from vendors
  const allLocalities = useMemo(() => {
    const locSet = new Set<string>();
    vendors.forEach((v) => {
      if (v.area) locSet.add(v.area);
      else if (v.address) {
        const parts = v.address.split(",");
        if (parts[0]) locSet.add(parts[0].trim());
      }
    });
    return Array.from(locSet).sort();
  }, [vendors]);

  // Filter and sort businesses
  const filteredVendors = useMemo(() => {
    let result = vendors;

    if (debouncedQ.trim()) {
      const query = debouncedQ.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.businessName.toLowerCase().includes(query) ||
          v.category?.name.toLowerCase().includes(query) ||
          (v.subcategory && v.subcategory.toLowerCase().includes(query)) ||
          (v.area && v.area.toLowerCase().includes(query)) ||
          (v.address && v.address.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== "ALL") {
      result = result.filter(
        (v) =>
          v.categoryId === selectedCategory ||
          v.category?.slug === selectedCategory ||
          v.category?.name.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedLocality !== "ALL") {
      result = result.filter(
        (v) =>
          (v.area && v.area.toLowerCase() === selectedLocality.toLowerCase()) ||
          (v.address && v.address.toLowerCase().includes(selectedLocality.toLowerCase()))
      );
    }

    // Sorting
    if (sort === "RATING_DESC") {
      result = [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === "REVIEWS_DESC") {
      result = [...result].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    } else if (sort === "NAME_ASC") {
      result = [...result].sort((a, b) => a.businessName.localeCompare(b.businessName));
    }

    return result;
  }, [vendors, debouncedQ, selectedCategory, selectedLocality, sort]);

  const clearAllFilters = () => {
    setQ("");
    setDebouncedQ("");
    setSelectedCategory("ALL");
    setSelectedLocality("ALL");
    setSort("DEFAULT");
  };

  const hasActiveFilters = q || selectedCategory !== "ALL" || selectedLocality !== "ALL" || sort !== "DEFAULT";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Explore Marketplace & Directory</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Discover local trades, businesses, and offerings across Patiala with authentic coordinates
          </p>
        </div>

        {/* Discovery Tab Selector */}
        <div className="flex rounded-xl bg-muted p-1 border border-border/60">
          <button
            onClick={() => setTab("BUSINESS")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "BUSINESS" ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 size={14} /> Businesses ({vendors.length})
          </button>
          <button
            onClick={() => setTab("SERVICE")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "SERVICE" ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench size={14} /> Services
          </button>
          <button
            onClick={() => setTab("PRODUCT")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "PRODUCT" ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package size={14} /> Products
          </button>
        </div>
      </div>

      {/* Advanced Search & Filter Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search Input */}
          <div className="md:col-span-5 flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 shadow-subtle focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
            <SearchIcon size={16} className="text-muted-foreground shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "BUSINESS"
                  ? "Search by business name, trade, or address..."
                  : `Search ${tab.toLowerCase()}s...`
              }
              className="w-full bg-transparent text-xs sm:text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-foreground shadow-subtle outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.slug} value={c.slug || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Locality Dropdown (Businesses Tab) */}
          {tab === "BUSINESS" && (
            <div className="md:col-span-2">
              <select
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-foreground shadow-subtle outline-none focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Localities</option>
                {allLocalities.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Dropdown */}
          <div className={tab === "BUSINESS" ? "md:col-span-2 flex items-center gap-2" : "md:col-span-4 flex items-center gap-2"}>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-foreground shadow-subtle outline-none focus:border-primary cursor-pointer"
              aria-label="Sort records"
            >
              <option value="DEFAULT">Sort: Recommended</option>
              <option value="RATING_DESC">Highest Rated</option>
              <option value="REVIEWS_DESC">Most Reviews</option>
              <option value="NAME_ASC">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Chips & View Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Active Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {tab === "BUSINESS" ? (
                <>Showing <strong className="text-foreground">{filteredVendors.length}</strong> businesses</>
              ) : (
                <>Showing <strong className="text-foreground">{offerings.length}</strong> {tab.toLowerCase()}s</>
              )}
            </span>

            {debouncedQ && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground font-medium border border-border">
                Keyword: "{debouncedQ}"
                <button onClick={() => setQ("")} className="hover:text-primary">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedCategory !== "ALL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground font-medium border border-border">
                Category: {categories.find((c) => c.slug === selectedCategory || c.id === selectedCategory)?.name || selectedCategory}
                <button onClick={() => setSelectedCategory("ALL")} className="hover:text-primary">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedLocality !== "ALL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground font-medium border border-border">
                Locality: {selectedLocality}
                <button onClick={() => setSelectedLocality("ALL")} className="hover:text-primary">
                  <X size={12} />
                </button>
              </span>
            )}

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 ml-1"
              >
                <RotateCcw size={11} /> Reset filters
              </button>
            )}
          </div>

          {/* Map View Toggle (Business Tab) */}
          {tab === "BUSINESS" && (
            <button
              onClick={() => setShowMap((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-subtle transition ${
                showMap
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-foreground border-border hover:bg-secondary"
              }`}
            >
              <MapIcon size={14} />
              {showMap ? "Hide Map" : "Show Map View"}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map Section (when toggled on) */}
      {tab === "BUSINESS" && showMap && (
        <div className="space-y-3">
          <DirectoryMap
            vendors={filteredVendors}
            selectedVendorId={selectedVendorId}
            onSelectVendor={setSelectedVendorId}
          />
        </div>
      )}

      {/* Main Results Grid */}
      <div>
        {loading ? (
          <CardSkeletonGrid count={8} />
        ) : tab === "BUSINESS" ? (
          filteredVendors.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No businesses found matching your criteria"
              description="Try adjusting your keyword, choosing a different category, or selecting another locality."
              action={
                <Button onClick={clearAllFilters} size="sm">
                  Clear All Filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )
        ) : offerings.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title={`No ${tab.toLowerCase()}s found`}
            description="Try adjusting your search criteria or clearing filters."
            action={
              <Button onClick={clearAllFilters} size="sm">
                Clear All Filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {offerings.map((o) =>
              tab === "PRODUCT" ? (
                <ProductCard key={o.id} product={o} />
              ) : (
                <ServiceCard key={o.id} service={o} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<CardSkeletonGrid count={8} />}>
      <ExploreContent />
    </Suspense>
  );
}
