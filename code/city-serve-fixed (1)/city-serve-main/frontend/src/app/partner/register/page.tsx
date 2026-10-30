"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setAccessToken, ApiRequestError } from "@/lib/api";
import Button from "@/components/ui/Button";
import LocationPicker, { LocationValue } from "@/components/LocationPicker";
import { useAuth } from "@/context/AuthContext";
import type { Category } from "@/types";

const FALLBACK_CATEGORIES: Category[] = [
  { id: "home-services", name: "Home Services", slug: "home-services", icon: "Wrench" },
  { id: "vehicle-services", name: "Vehicle Services", slug: "vehicle-services", icon: "Car" },
  { id: "personal-care", name: "Personal Care", slug: "personal-care", icon: "Sparkles" },
  { id: "education", name: "Education", slug: "education", icon: "GraduationCap" },
  { id: "photography", name: "Photography", slug: "photography", icon: "Camera" },
  { id: "moving", name: "Moving Services", slug: "moving", icon: "Truck" },
  { id: "laundry-care", name: "Laundry & Care", slug: "laundry-care", icon: "Shirt" },
  { id: "technology", name: "Technology & Repairs", slug: "technology", icon: "Smartphone" },
];

export default function PartnerRegisterPage() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    password: "",
    categoryId: "home-services",
    partnerType: "SERVICE" as "PRODUCT" | "SERVICE" | "BOTH",
    description: "",
    serviceRadiusKm: 5,
  });
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then((cats) => {
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          setForm((f) => ({ ...f, categoryId: cats[0].id || cats[0].slug }));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location) {
      setError("Please set your business location on the map/address picker.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/register/vendor", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        businessName: form.businessName,
        categoryId: form.categoryId,
        type: form.partnerType,
        description: form.description,
        address: location.formattedAddress,
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setAccessToken(res.accessToken);
      await refreshMe();
      setSuccess(true);
      setTimeout(() => router.push("/partner-dashboard"), 1500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-2xl">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">Registration Submitted</h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Your business profile was created. Redirecting to your partner management dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">List Your Business</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Join the CityServe directory and connect with residents and students across Patiala.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Contact Person Name</label>
              <input
                required
                placeholder="e.g. Ramesh Kumar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Business / Shop Name</label>
              <input
                required
                placeholder="e.g. Patiala Electricals & Care"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <input
                required
                type="email"
                placeholder="partner@business.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Business Phone</label>
              <input
                required
                placeholder="e.g. 9876501234"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Password (min 8 characters)</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id || c.slug} value={c.id || c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Offering Type</label>
              <select
                value={form.partnerType}
                onChange={(e) => setForm({ ...form, partnerType: e.target.value as any })}
                className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="SERVICE">Service (e.g. repairs, haircut, tuition)</option>
                <option value="PRODUCT">Products (e.g. dairy, groceries)</option>
                <option value="BOTH">Both Products & Services</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Business Overview</label>
            <textarea
              placeholder="Brief summary of your local services, specialties, and workshop location..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={3}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">
              Business Location in Patiala
            </label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} loading={loading} className="mt-2 w-full py-2.5 text-xs font-bold shadow-subtle">
            Submit Business Application
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Listings undergo verification review before being awarded the verified partner badge.
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground pt-4 border-t border-border/60">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Partner Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
