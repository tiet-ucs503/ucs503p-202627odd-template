"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setAccessToken, ApiRequestError } from "@/lib/api";
import Button from "@/components/ui/Button";
import LocationPicker, { LocationValue } from "@/components/LocationPicker";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/register/customer", {
        ...form,
        address: location?.formattedAddress,
        city: location?.city,
      });
      setAccessToken(res.accessToken);
      await refreshMe();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">Create an account</h1>
          <p className="mt-1 text-xs text-muted-foreground">Join CityServe to order essentials and book local trades.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground">Full Name</label>
            <input
              required
              placeholder="e.g. Gurpreet Singh"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Email Address</label>
            <input
              required
              type="email"
              placeholder="name@thapar.edu or personal email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Phone Number</label>
            <input
              required
              placeholder="e.g. 9876543210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
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

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Your Patiala Address</label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} loading={loading} className="mt-2 w-full py-2.5 text-xs font-bold shadow-subtle">
            Create Account
          </Button>
        </form>

        <div className="pt-2 border-t border-border/60 text-center space-y-2 text-xs text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
          <p className="text-[11px]">
            Own a local trade or business?{" "}
            <Link href="/partner/register" className="font-semibold text-primary hover:underline">
              Register as a partner
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
