"use client";

import Link from "next/link";
import { MapPin, ArrowUpRight, Phone } from "lucide-react";
import { getCategoryIcon } from "@/lib/icons";
import { VerifiedBadge, DirectoryBadge } from "@/components/ui/Badge";
import RatingStars from "@/components/ui/RatingStars";
import type { Vendor } from "@/types";

export default function VendorCard({ vendor }: { vendor: Vendor }) {
  const Icon = getCategoryIcon(vendor.category?.icon || vendor.category?.name || "");
  const locality = vendor.area || (vendor.address ? vendor.address.split(",")[0] : null) || vendor.city || "Patiala";

  return (
    <Link
      href={`/vendor/${vendor.id}`}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardHover hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div>
        {/* Top Meta Bar */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon size={20} strokeWidth={2} />
          </div>

          <div className="flex flex-col items-end gap-1">
            {vendor.isVerified ? (
              <VerifiedBadge />
            ) : (
              <DirectoryBadge source={vendor.source} />
            )}
          </div>
        </div>

        {/* Business Category and Name */}
        <div className="space-y-1">
          {vendor.category && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {vendor.category.name}
              {vendor.subcategory ? ` · ${vendor.subcategory}` : ""}
            </p>
          )}

          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-snug">
            {vendor.businessName}
          </h3>
        </div>

        {/* Description if present */}
        {vendor.description && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {vendor.description}
          </p>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-5 pt-3.5 border-t border-border/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <MapPin size={13} className="text-primary shrink-0" />
            <span className="truncate max-w-[150px] font-medium text-foreground/80">{locality}</span>
          </div>

          <RatingStars rating={vendor.rating} reviewCount={vendor.reviewCount} size={12} />
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          {vendor.phone ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone size={11} className="text-primary" />
              <span>{vendor.phone}</span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Local Listing</span>
          )}

          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary group-hover:underline">
            View Details
            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

