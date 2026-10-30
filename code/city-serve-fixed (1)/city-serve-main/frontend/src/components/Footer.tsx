import Link from "next/link";
import { ArrowUpRight, Shield, MapPin, Sparkles } from "lucide-react";
import type { Category } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Footer() {
  const categories = await getCategories();

  return (
    <footer className="border-t border-border bg-card text-card-foreground transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5 lg:gap-12">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-serif font-bold text-lg shadow-subtle">
                C
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                City<span className="text-primary font-serif">Serve</span>
              </span>
            </Link>

            <p className="text-xs leading-relaxed text-muted-foreground max-w-sm">
              The local discovery platform for Patiala and the Thapar community. Connecting residents and students with trusted local professionals, essential services, and trades.
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <MapPin size={13} className="text-primary" />
              <span>Patiala, Punjab — Focused on local discoverability</span>
            </div>
          </div>

          {/* Categories Col */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Local Categories
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="hover:text-primary transition-colors">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/explore" className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5">
                  Browse all directory <ArrowUpRight size={12} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links Col */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Platform & Partners
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/explore" className="hover:text-primary transition-colors">
                  Explore Businesses
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-colors">
                  Service Offerings
                </Link>
              </li>
              <li>
                <Link href="/partner/register" className="hover:text-primary transition-colors">
                  List Your Business
                </Link>
              </li>
              <li>
                <Link href="/partner-dashboard" className="hover:text-primary transition-colors">
                  Partner Dashboard
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-primary transition-colors">
                  Help & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust Standards Col */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Directory Standards
            </p>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Shield size={14} className="text-primary mt-0.5 shrink-0" />
                <span>Clear distinction between public directory listings and verified partners.</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                <span>Accurate locality addresses and real coordinates around Patiala.</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                <span>Direct contact details for easy local coordination.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CityServe. Patiala, Punjab.</p>
          <p className="text-[11px] text-center sm:text-right">
            Independent local services directory · Unverified listings are clearly marked as directory entries.
          </p>
        </div>
      </div>
    </footer>
  );
}

