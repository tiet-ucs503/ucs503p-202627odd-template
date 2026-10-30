"use client";

import Link from "next/link";
import { ShieldCheck, Clock, CalendarCheck, Zap, Heart } from "lucide-react";
import MediaTile from "./ui/MediaTile";
import { formatINR } from "@/lib/format";
import { getCategoryIcon } from "@/lib/icons";
import type { Offering } from "@/types";
import { useState } from "react";

export default function ServiceCard({ service }: { service: Offering }) {
  const Icon = service.category ? getCategoryIcon(service.category.icon) : Zap;
  const [isFav, setIsFav] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFav((f) => !f);
  };

  const duration = service.durationMinutes ?? 60;
  const durationLabel = duration >= 60
    ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ""}`
    : `${duration} min`;

  return (
    <Link
      href={`/service/${service.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-cardHover"
    >
      <div className="relative">
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.imageUrl}
            alt={service.name}
            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <MediaTile icon={Icon} className="h-36 bg-gradient-to-br from-accent/40 to-primary/10" size={24} />
        )}

        {/* Favorite */}
        <button
          onClick={handleFavorite}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-all ${isFav ? "bg-rose-500 text-white scale-110" : "bg-card/80 text-muted-foreground hover:text-rose-500"
            }`}
          aria-label="Add to favorites"
        >
          <Heart size={14} className={isFav ? "fill-current" : ""} />
        </button>

        {/* Duration badge */}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card/90 backdrop-blur-md text-[10px] font-semibold text-primary uppercase tracking-wider border border-border/50">
          <Clock size={9} /> {durationLabel}
        </span>

        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-card/90 backdrop-blur-md text-[10px] font-semibold text-primary uppercase tracking-wider border border-border/50">
          Service
        </span>
      </div>


      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-semibold text-sm leading-snug text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
          {service.name}
        </p>

        {service.vendor && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {service.vendor.isVerified && (
              <ShieldCheck size={12} className="shrink-0 text-primary" />
            )}
            <span className="truncate">{service.vendor.businessName}</span>
          </p>
        )}

        {service.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {service.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50">
          <div>
            <p className="text-sm font-bold text-foreground">
              {service.price != null ? (
                <>
                  <span className="text-[11px] font-normal text-muted-foreground">From </span>
                  {formatINR(service.price)}
                </>
              ) : (
                "Contact for pricing"
              )}
            </p>
          </div>

          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold group-hover:bg-primary group-hover:text-white transition-all duration-200">
            <CalendarCheck size={13} />
            <span>Book</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
