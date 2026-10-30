"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Navigation, ExternalLink, ShieldCheck } from "lucide-react";
import type { Vendor } from "@/types";

interface Props {
  vendors: Vendor[];
  selectedVendorId: string | null;
  onSelectVendor: (id: string | null) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function DirectoryMap({ vendors, selectedVendorId, onSelectVendor }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const validVendors = vendors.filter(
    (v) => typeof v.latitude === "number" && typeof v.longitude === "number" && v.latitude !== 0 && v.longitude !== 0
  );

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapError(true);
      return;
    }

    let isMounted = true;

    async function initMapbox() {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (!isMounted || !mapContainerRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN as string;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [76.38, 30.34], // Patiala center
          zoom: 12,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (!isMounted) return;
          mapInstanceRef.current = map;
          setMapboxLoaded(true);
        });

        map.on("error", () => {
          if (isMounted) setMapError(true);
        });
      } catch (e) {
        if (isMounted) setMapError(true);
      }
    }

    initMapbox();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when vendors or selected vendor change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapboxLoaded) return;
    const mapboxgl = require("mapbox-gl");

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasCoords = false;

    validVendors.forEach((v) => {
      const isSelected = v.id === selectedVendorId;
      const el = document.createElement("div");
      el.className = `cursor-pointer rounded-full p-1.5 shadow-md transition-transform ${
        isSelected ? "bg-primary text-white scale-125 z-20 ring-4 ring-primary/20" : "bg-card text-primary hover:scale-110 z-10 border border-border"
      }`;
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

      el.addEventListener("click", () => {
        onSelectVendor(v.id);
      });

      const popupHtml = `
        <div style="font-family: inherit; padding: 4px; min-width: 180px;">
          <p style="font-weight: 700; font-size: 13px; color: #202321; margin: 0 0 2px 0;">${v.businessName}</p>
          <p style="font-size: 11px; color: #777970; margin: 0 0 6px 0;">${v.category?.name || "Local Trade"} · ${v.area || v.city || "Patiala"}</p>
          <a href="/vendor/${v.id}" style="display: inline-block; font-size: 11px; font-weight: 600; color: #244C3A; text-decoration: underline;">View business details →</a>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([v.longitude!, v.latitude!])
        .setPopup(popup)
        .addTo(mapInstanceRef.current);

      markersRef.current.push(marker);

      bounds.extend([v.longitude!, v.latitude!]);
      hasCoords = true;
    });

    if (hasCoords && validVendors.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }
  }, [validVendors, selectedVendorId, mapboxLoaded, onSelectVendor]);

  // Fallback view when Mapbox is in demo mode or token is unset
  if (mapError || !MAPBOX_TOKEN) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Patiala Geographical Coordinates
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
            {validVendors.length} Real Mapped Locations
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Interactive Mapbox view is running in local list fallback mode. All {validVendors.length} listings have authentic Patiala coordinates and can be inspected below or opened in maps:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {validVendors.slice(0, 30).map((v) => (
            <div
              key={v.id}
              onClick={() => onSelectVendor(v.id === selectedVendorId ? null : v.id)}
              className={`rounded-xl border p-3 cursor-pointer transition-colors text-xs ${
                v.id === selectedVendorId
                  ? "border-primary bg-secondary/50 text-foreground"
                  : "border-border/60 bg-background hover:bg-secondary/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-foreground truncate">{v.businessName}</p>
                {v.isVerified && <ShieldCheck size={12} className="text-primary shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {v.area || v.city || "Patiala"} ({v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)})
              </p>
              <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-border/40">
                <Link
                  href={`/vendor/${v.id}`}
                  className="font-semibold text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View listing
                </Link>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Navigation size={11} /> Open Map <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-border overflow-hidden shadow-card h-96 w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
