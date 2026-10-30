"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Building2,
  Phone,
  Globe,
  ExternalLink,
  Navigation,
  Database,
  ArrowLeft,
  CalendarCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import ServiceCard from "@/components/ServiceCard";
import RatingStars from "@/components/ui/RatingStars";
import { VerifiedBadge, DirectoryBadge } from "@/components/ui/Badge";
import MediaTile from "@/components/ui/MediaTile";
import { getCategoryIcon } from "@/lib/icons";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import type { Vendor, Offering, Review, Category } from "@/types";

type VendorDetail = Vendor & { category?: Category; Offerings?: Offering[] };

export default function VendorProfilePage({ params }: { params: { id: string } }) {
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVendor() {
      setLoading(true);
      try {
        // First try backend API
        const v = await api.get<VendorDetail>(`/vendors/${params.id}`);
        if (v && v.id) {
          setVendor(v);
          loadReviews(v.id);
          return;
        }
      } catch {
        // Fallback to directory lookup below
      }

      // Try directory route
      try {
        const res = await fetch(`/api/directory?id=${params.id}`);
        if (res.ok) {
          const v = await res.json();
          setVendor(v);
        } else {
          setVendor(null);
        }
      } catch {
        setVendor(null);
      } finally {
        setLoading(false);
      }
    }

    async function loadReviews(vendorId: string) {
      try {
        const r = await api.get<Review[]>(`/reviews/vendor/${vendorId}`);
        setReviews(Array.isArray(r) ? r : []);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }

    loadVendor();
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={Building2}
          title="Business not found"
          description="The business profile or listing you requested could not be located in our directory."
          action={
            <Link href="/explore">
              <Button size="sm">Browse Directory</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const Icon = getCategoryIcon(vendor.category?.icon || vendor.category?.name || "");
  const offerings = vendor.Offerings ?? [];
  const products = offerings.filter((o) => o.type === "PRODUCT");
  const services = offerings.filter((o) => o.type === "SERVICE");
  const locality = vendor.area || (vendor.address ? vendor.address.split(",")[0] : null) || vendor.city || "Patiala";

  // Validate external website URL
  const isValidWebsite =
    vendor.website &&
    (vendor.website.startsWith("http://") || vendor.website.startsWith("https://")) &&
    vendor.website !== "NA" &&
    vendor.website !== "null";

  // Validate phone number
  const hasPhone =
    vendor.phone &&
    vendor.phone !== "NA" &&
    vendor.phone !== "null" &&
    !vendor.phone.startsWith("IMPORTED-");

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : vendor.rating ?? null;

  const totalReviews = reviews.length > 0 ? reviews.length : vendor.reviewCount ?? null;

  return (
    <div className="space-y-12 pb-20">
      {/* Top Breadcrumb Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to Directory
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary shadow-subtle border border-border/60">
                <Icon size={36} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {vendor.isVerified ? (
                    <VerifiedBadge />
                  ) : (
                    <DirectoryBadge source={vendor.source} />
                  )}
                  {vendor.category && (
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {vendor.category.name}
                      {vendor.subcategory ? ` · ${vendor.subcategory}` : ""}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">
                  {vendor.businessName}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                  <RatingStars rating={avgRating} reviewCount={totalReviews} size={14} />

                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin size={13} className="text-primary" />
                    <span>{locality}, Patiala</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {hasPhone && (
                <a
                  href={`tel:${vendor.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-subtle hover:bg-primary-hover transition"
                >
                  <Phone size={14} /> Call {vendor.phone}
                </a>
              )}

              {isValidWebsite && (
                <a
                  href={vendor.website!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary shadow-subtle transition"
                >
                  <Globe size={14} className="text-primary" /> Visit Website <ExternalLink size={11} />
                </a>
              )}

              {typeof vendor.latitude === "number" && typeof vendor.longitude === "number" && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary shadow-subtle transition"
                >
                  <Navigation size={14} className="text-primary" /> Directions <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Left Column: Offerings, About, Reviews */}
          <div className="lg:col-span-8 space-y-10">
            {/* Description */}
            {vendor.description && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
                <h2 className="text-base font-bold text-foreground">About the Business</h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {vendor.description}
                </p>
              </div>
            )}

            {/* Services if available */}
            {services.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-serif text-foreground">Available Services</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {services.map((s) => (
                    <ServiceCard key={s.id} service={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Products if available */}
            {products.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-serif text-foreground">Products & Catalog</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Customer Reviews Section */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-lg font-serif text-foreground">Customer Reviews</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Verified community ratings</p>
                </div>
                <RatingStars rating={avgRating} reviewCount={totalReviews} size={15} />
              </div>

              {reviews.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No platform customer reviews recorded for this listing yet.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Reviews can be submitted by verified customers upon completed service delivery.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {r.customer?.name ?? "Verified Customer"}
                        </span>
                        <RatingStars rating={r.rating} size={11} showEmptyNotice={false} />
                      </div>
                      {r.comment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {r.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Location & Provenance Metadata */}
          <div className="lg:col-span-4 space-y-6">
            {/* Location & Contact Card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border/60 pb-3">
                Location & Contact
              </h3>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Address</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      {vendor.address || `${locality}, Patiala, Punjab`}
                    </p>
                  </div>
                </div>

                {hasPhone && (
                  <div className="flex items-start gap-3">
                    <Phone size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Phone</p>
                      <a href={`tel:${vendor.phone}`} className="text-primary hover:underline mt-0.5 block">
                        {vendor.phone}
                      </a>
                    </div>
                  </div>
                )}

                {typeof vendor.latitude === "number" && typeof vendor.longitude === "number" && (
                  <div className="flex items-start gap-3">
                    <Navigation size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Coordinates</p>
                      <p className="text-muted-foreground mt-0.5">
                        {vendor.latitude.toFixed(4)}° N, {vendor.longitude.toFixed(4)}° E
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Data Provenance & Verification Transparency Card */}
            <div className="rounded-2xl border border-border bg-secondary/30 p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Database size={14} className="text-primary" />
                <span>Listing Information</span>
              </div>

              <div className="space-y-2 text-muted-foreground text-[11px] leading-relaxed">
                <p>
                  <strong>Verification Status:</strong>{" "}
                  {vendor.isVerified ? "Verified Local Partner" : "Directory Listing (Unclaimed)"}
                </p>
                {vendor.source && (
                  <p>
                    <strong>Data Source:</strong> {vendor.source}
                  </p>
                )}
                <p className="pt-1 text-[11px] text-muted-foreground/90 border-t border-border/50">
                  This listing is provided for local discovery. If you own this business, you may claim or update its profile through CityServe Partner registration.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
