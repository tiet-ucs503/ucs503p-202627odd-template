"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, Wrench, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import CategoryCard from "@/components/CategoryCard";
import ServiceCard from "@/components/ServiceCard";
import { CardSkeletonGrid } from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import type { Category, Offering } from "@/types";

const FALLBACK_CATEGORIES: Category[] = [
  { id: "home-services", name: "Home Services", slug: "home-services", icon: "Wrench", description: "Electricians, plumbers, carpentry, and home repair specialists." },
  { id: "vehicle-services", name: "Vehicle Services", slug: "vehicle-services", icon: "Car", description: "Mechanics, car wash, detailing, and two-wheeler servicing." },
  { id: "personal-care", name: "Personal Care", slug: "personal-care", icon: "Sparkles", description: "Salons, barbers, wellness, and bespoke tailoring." },
  { id: "education", name: "Education", slug: "education", icon: "GraduationCap", description: "Tutors, subject coaching, competitive exams, and skill courses." },
  { id: "photography", name: "Photography", slug: "photography", icon: "Camera", description: "Event, portrait, commercial, and studio photographers." },
  { id: "moving", name: "Moving Services", slug: "moving", icon: "Truck", description: "Packers, movers, and household relocation services." },
  { id: "laundry-care", name: "Laundry & Care", slug: "laundry-care", icon: "Shirt", description: "Laundry pickup, dry cleaning, ironing, and garment care." },
  { id: "technology", name: "Technology & Repairs", slug: "technology", icon: "Smartphone", description: "Mobile phone, laptop, and electronic device repairs." },
];

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [catRes, svcRes] = await Promise.allSettled([
          api.get<Category[]>("/categories"),
          api.get<Offering[]>("/catalog/services"),
        ]);

        if (catRes.status === "fulfilled" && Array.isArray(catRes.value) && catRes.value.length > 0) {
          setCategories(catRes.value);
        } else {
          setCategories(FALLBACK_CATEGORIES);
        }

        if (svcRes.status === "fulfilled" && Array.isArray(svcRes.value)) {
          setServices(svcRes.value);
        }
      } catch {
        setCategories(FALLBACK_CATEGORIES);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-foreground font-bold">Services & Trade Categories</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Browse local trades, doorstep maintenance, and professional services across Patiala
          </p>
        </div>
        <Link href="/explore">
          <Button variant="outline" size="sm">
            Explore Full Directory <ArrowRight size={13} />
          </Button>
        </Link>
      </div>

      {loading ? (
        <CardSkeletonGrid count={8} />
      ) : (
        <div className="space-y-12">
          {/* Categories Grid */}
          <section className="space-y-4">
            <h2 className="text-xl font-serif text-foreground">Sectors & Trade Categories</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <CategoryCard key={c.id || c.slug} category={c} />
              ))}
            </div>
          </section>

          {/* Bookable Services if present */}
          {services.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border/60">
              <h2 className="text-xl font-serif text-foreground">Direct Service Bookings</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {services.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
