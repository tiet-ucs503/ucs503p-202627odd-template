import { Star } from "lucide-react";

export default function RatingStars({
  rating,
  reviewCount,
  size = 13,
  showEmptyNotice = true,
}: {
  rating?: number | null;
  reviewCount?: number | null;
  size?: number;
  showEmptyNotice?: boolean;
}) {
  const numRating = typeof rating === "number" ? rating : Number(rating);
  const numReviews = typeof reviewCount === "number" ? reviewCount : Number(reviewCount);

  if (!numRating || isNaN(numRating) || numRating <= 0) {
    if (!showEmptyNotice) return null;
    return (
      <span className="inline-flex items-center text-xs text-muted-foreground font-normal">
        Not rated yet
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
      <Star size={size} className="fill-amber-500 text-amber-500 shrink-0" />
      <span>{numRating.toFixed(1)}</span>
      {Number.isFinite(numReviews) && numReviews > 0 && (
        <span className="text-muted-foreground text-[11px] font-normal">
          ({numReviews})
        </span>
      )}
    </span>
  );
}

