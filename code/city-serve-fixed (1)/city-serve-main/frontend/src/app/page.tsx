import Link from "next/link";
import {
  ArrowRight,
  Shield,
  MapPin,
  Search,
  PhoneCall,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  Building2,
  Wrench,
  Car,
  Sparkles,
  GraduationCap,
  Camera,
  Truck,
  Shirt,
  Smartphone,
} from "lucide-react";
import CategoryCard from "@/components/CategoryCard";
import HeroSearch from "@/components/HeroSearch";
import VendorCard from "@/components/VendorCard";
import ProductCard from "@/components/ProductCard";
import ServiceCard from "@/components/ServiceCard";
import { getDatasetBusinesses, datasetToVendor, getLocalitiesWithCounts } from "@/lib/dataset";
import type { Category, Offering, Vendor } from "@/types";

export const revalidate = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const CORE_CATEGORIES: Category[] = [
  { id: "home-services", name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, carpentry, and home repair specialists." },
  { id: "vehicle-services", name: "Vehicle Services", slug: "vehicle-services", icon: "Car", description: "Mechanics, car wash, detailing, and two-wheeler servicing." },
  { id: "personal-care", name: "Personal Care", slug: "personal-care", icon: "Sparkles", description: "Salons, barbers, wellness, and bespoke tailoring." },
  { id: "education", name: "Education", slug: "education", icon: "GraduationCap", description: "Tutors, subject coaching, competitive exams, and skill courses." },
  { id: "photography", name: "Photography", slug: "photography", icon: "Camera", description: "Event, portrait, commercial, and studio photographers." },
  { id: "moving", name: "Moving Services", slug: "moving", icon: "Truck", description: "Packers, movers, and household relocation services." },
  { id: "laundry-care", name: "Laundry & Care", slug: "laundry-care", icon: "Shirt", description: "Laundry pickup, dry cleaning, ironing, and garment care." },
  { id: "technology", name: "Technology & Repairs", slug: "technology", icon: "Smartphone", description: "Mobile phone, laptop, and electronic device repairs." },
];

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 60 } });
    if (!res.ok) return CORE_CATEGORIES;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data : CORE_CATEGORIES;
  } catch {
    return CORE_CATEGORIES;
  }
}

async function getVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${API_URL}/vendors`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // fallback to dataset below
  }

  // Load from Patiala dataset
  const dataset = getDatasetBusinesses();
  return dataset.slice(0, 8).map(datasetToVendor);
}

async function getOfferings(type: "PRODUCT" | "SERVICE"): Promise<Offering[]> {
  try {
    const res = await fetch(`${API_URL}/catalog?type=${type}&pageSize=4`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 4) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [categories, vendors, products, services] = await Promise.all([
    getCategories(),
    getVendors(),
    getOfferings("PRODUCT"),
    getOfferings("SERVICE"),
  ]);

  const localities = getLocalitiesWithCounts().slice(0, 10);
  const totalBusinessesCount = getDatasetBusinesses().length || vendors.length;

  return (
    <div className="space-y-20 pb-20">

      {/* ── 5C: EDITORIAL HERO SECTION ───────────────────────────────────── */}
      <section className="relative border-b border-border bg-gradient-to-b from-secondary/30 via-background to-background pt-12 pb-16 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary shadow-subtle">
                <Compass size={13} className="text-primary" />
                <span>YOUR CITY, BETTER CONNECTED</span>
              </div>

              <h1 className="text-3xl font-serif sm:text-5xl lg:text-5xl font-normal tracking-tight text-foreground leading-[1.15]">
                Good local services. <br />
                <span className="italic font-serif text-primary">Closer than you think.</span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
                Discover local professionals and businesses across Patiala, all in one place. Explore verified trades, doorstep services, and community essentials.
              </p>

              {/* Prominent Multi-field Search Bar */}
              <div className="pt-2 max-w-2xl">
                <HeroSearch categories={categories} />
              </div>

              {/* Quick Discovery Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">Popular:</span>
                {["Electricians", "Car Wash", "Tutors", "Salons", "Dry Cleaning", "Mobile Repair"].map((tag) => (
                  <Link
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground/80 hover:text-primary hover:bg-secondary/80 transition-colors border border-border/40"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Hero Visual Composition */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md">
                {/* Visual card showcase */}
                <div className="rounded-3xl border border-border bg-card p-6 shadow-card hover:shadow-cardHover transition-shadow space-y-5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="text-xs font-bold tracking-wide uppercase text-foreground">
                        Patiala Local Directory
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                      {totalBusinessesCount} Verified Listings
                    </span>
                  </div>

                  {/* Highlights stack */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl bg-secondary/40 p-3.5 border border-border/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                        <Wrench size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">Home & Electrical Care</p>
                          <span className="text-[10px] text-muted-foreground">30+ trades</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">AC servicing, certified plumbers & electricians</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-secondary/40 p-3.5 border border-border/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                        <Car size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">Automotive & Detailing</p>
                          <span className="text-[10px] text-muted-foreground">18+ workshops</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Multi-brand mechanics, foam wash & PPF</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-secondary/40 p-3.5 border border-border/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                        <Shirt size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">Laundry & Dry Cleaning</p>
                          <span className="text-[10px] text-muted-foreground">15+ centers</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Hostel pickup & 24h express turnaround</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} className="text-primary" />
                      <span>Thapar Campus, Model Town, Tripuri</span>
                    </span>
                    <Link href="/explore" className="font-semibold text-primary hover:underline">
                      View all →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5D: QUICK CATEGORY DISCOVERY ─────────────────────────────────── */}
      <section id="categories" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <h2 className="text-2xl font-serif text-foreground">Explore Categories</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Find specialized services and local businesses across 8 core sectors
            </p>
          </div>
          <Link
            href="/explore"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            All Categories <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((cat) => (
            <CategoryCard key={cat.id || cat.slug} category={cat} />
          ))}
        </div>
      </section>

      {/* ── 5E: DISCOVER LOCAL BUSINESSES ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <h2 className="text-2xl font-serif text-foreground">Explore Businesses Around Patiala</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Real listings from the Patiala local service community with authentic locations
            </p>
          </div>
          <Link
            href="/explore"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            View Complete Directory ({totalBusinessesCount}) <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {vendors.slice(0, 8).map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      </section>

      {/* ── 5F: NEAR YOUR NEIGHBOURHOOD ──────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-10 shadow-card">
          <div className="max-w-2xl mb-8 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
              <MapPin size={13} />
              <span>Neighbourhood Discovery</span>
            </div>
            <h2 className="text-2xl font-serif text-foreground">Discover Services by Locality</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Find professionals and shops close to your hostel, residence, or workplace across Patiala.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {localities.map((loc) => (
              <Link
                key={loc.name}
                href={`/explore?locality=${encodeURIComponent(loc.name)}`}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-background p-4 hover:border-primary/50 hover:bg-secondary/30 transition"
              >
                <div>
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {loc.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {loc.count} listing{loc.count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-primary">
                  <span>Browse</span>
                  <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── POPULAR SERVICES & PRODUCTS (When backend data exists) ───────── */}
      {services.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-serif text-foreground">Featured Services</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Book appointments directly with partner professionals</p>
            </div>
            <Link href="/services" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              All Services <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-serif text-foreground">Campus Daily Essentials</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Farm dairy, fresh groceries, and student tiffins</p>
            </div>
            <Link href="/explore?type=PRODUCT" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Browse Essentials <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── 5G: HOW CITYSERVE WORKS (Concise 3 steps) ────────────────────── */}
      <section id="how-it-works" className="border-y border-border bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Simple & Direct</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-foreground">How CityServe Works</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              A transparent local marketplace designed for ease of discovery
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-subtle">
              <span className="font-serif text-3xl font-bold text-primary">01</span>
              <div>
                <h3 className="font-bold text-base text-foreground">Discover</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Search by trade, business name, or locality to find relevant local providers in and around Patiala.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-subtle">
              <span className="font-serif text-3xl font-bold text-primary">02</span>
              <div>
                <h3 className="font-bold text-base text-foreground">Connect</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Review available information, address, ratings, and verification credentials to choose a suitable provider.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-subtle">
              <span className="font-serif text-3xl font-bold text-primary">03</span>
              <div>
                <h3 className="font-bold text-base text-foreground">Get Started</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Call directly, visit the workshop, or use the service booking workflow supported by the application.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5H: TRUST AND TRANSPARENCY ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-12 shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
              <Shield size={14} />
              <span>Transparency Standards</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-foreground">Evaluating Local Listings</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              CityServe provides honest signals so you know exactly which listings are independently verified partners versus community directory entries.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 rounded-2xl bg-secondary/30 p-5 border border-border/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                <CheckCircle2 size={18} />
              </div>
              <h4 className="font-bold text-sm text-foreground">Verified Partners</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Businesses with the <span className="font-semibold text-primary">Verified</span> badge have submitted business and identity credentials confirmed by CityServe.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-secondary/30 p-5 border border-border/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-subtle">
                <Building2 size={18} />
              </div>
              <h4 className="font-bold text-sm text-foreground">Directory Entries</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Listings marked <span className="font-semibold text-foreground">Directory Listing</span> are sourced from public records. They are not independently verified.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-secondary/30 p-5 border border-border/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                <PhoneCall size={18} />
              </div>
              <h4 className="font-bold text-sm text-foreground">Direct Contact</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Real phone numbers and addresses are displayed when available so you can contact tradespeople directly.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-secondary/30 p-5 border border-border/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-primary shadow-subtle">
                <Clock size={18} />
              </div>
              <h4 className="font-bold text-sm text-foreground">Authentic Reviews</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ratings are drawn from genuine records. We never display fake reviews, fabricated discounts, or false certified seals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARTNER CALL TO ACTION ───────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-primary/30 bg-secondary/50 p-8 md:p-12 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <h3 className="text-2xl font-serif text-foreground">Own a local service business in Patiala?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Claim your listing or register as a partner to receive service inquiries and connect with thousands of local students and households.
            </p>
          </div>
          <Link
            href="/partner/register"
            className="shrink-0 rounded-xl bg-primary px-6 py-3 text-xs font-semibold text-white shadow-subtle hover:bg-primary-hover transition"
          >
            Register as a Partner
          </Link>
        </div>
      </section>

    </div>
  );
}
