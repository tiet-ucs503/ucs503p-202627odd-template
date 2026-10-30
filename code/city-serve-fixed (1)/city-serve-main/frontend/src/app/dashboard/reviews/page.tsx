"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import type { Review } from "@/types";

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Review[]>("/reviews").then(setReviews).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No reviews yet"
        description="Once you complete an order, you can rate and review it here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{r.vendor?.businessName ?? "Vendor"}</p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={14} className={n <= r.rating ? "fill-primary text-primary" : "text-border"} />
              ))}
            </div>
          </div>
          {r.offering?.name && <p className="mt-1 text-xs text-muted-foreground">{r.offering.name}</p>}
          {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
