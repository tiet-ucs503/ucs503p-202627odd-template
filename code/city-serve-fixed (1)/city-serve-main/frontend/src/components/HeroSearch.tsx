"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Tag } from "lucide-react";
import Button from "@/components/ui/Button";

const TOP_LOCALITIES = [
  "All Localities",
  "Model Town",
  "Tripuri",
  "Urban Estate",
  "Leela Bhawan",
  "Ranjit Nagar",
  "Nabha Gate",
  "Upkar Nagar",
  "Adalat Bazar",
  "Bank Colony",
  "New Lal Bagh Colony",
];

export default function HeroSearch({
  categories = [],
}: {
  categories?: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [locality, setLocality] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (locality && locality !== "All Localities") params.set("locality", locality);

    const qs = params.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl border border-border/80 bg-card p-2 shadow-card hover:shadow-cardHover transition-shadow"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        {/* Keyword Search */}
        <div className="md:col-span-5 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/40 focus-within:border-primary/60 transition-colors">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search service, trade, or business..."
            className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {/* Category Select */}
        <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/40 focus-within:border-primary/60 transition-colors">
          <Tag size={15} className="text-muted-foreground shrink-0" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm text-foreground outline-none cursor-pointer"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Locality Select */}
        <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/40 focus-within:border-primary/60 transition-colors">
          <MapPin size={15} className="text-primary shrink-0" />
          <select
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm text-foreground outline-none cursor-pointer"
            aria-label="Filter by neighbourhood"
          >
            {TOP_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Search Submit Button */}
        <div className="md:col-span-1 flex items-center">
          <Button
            type="submit"
            size="md"
            className="w-full h-full py-2.5 px-4 font-semibold text-xs tracking-wide"
            aria-label="Submit search"
          >
            Search
          </Button>
        </div>
      </div>
    </form>
  );
}

