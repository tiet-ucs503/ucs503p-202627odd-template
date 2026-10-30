import { distanceKm } from "./distance";

/**
 * Simple, explainable recommendation score (NOT machine learning — MVP only).
 * Weighted sum of normalized signals, each 0-1:
 *   - proximity   (closer is better)
 *   - rating      (avgRating / 5)
 *   - verified    (1 if verified, else 0)
 *   - availability(1 if available/active right now)
 *   - priceValue  (cheaper relative to category median scores slightly higher)
 *
 * Weights are intentionally simple and documented so the score is explainable
 * to a customer or professor, not a black box.
 */
export interface RecommendationInput {
  partnerLat: number;
  partnerLng: number;
  userLat?: number | null;
  userLng?: number | null;
  avgRating: number;
  isVerified: boolean;
  isAvailable: boolean;
  price: number;
  categoryMedianPrice: number;
}

const WEIGHTS = {
  proximity: 0.3,
  rating: 0.3,
  verified: 0.2,
  availability: 0.1,
  priceValue: 0.1,
};

export function computeRecommendationScore(input: RecommendationInput): number {
  let proximityScore = 0.5; // neutral if user location unknown
  if (input.userLat != null && input.userLng != null) {
    const d = distanceKm(input.partnerLat, input.partnerLng, input.userLat, input.userLng);
    proximityScore = Math.max(0, 1 - d / 15); // 0km -> 1, 15km+ -> 0
  }

  const ratingScore = Math.min(1, Math.max(0, input.avgRating / 5));
  const verifiedScore = input.isVerified ? 1 : 0;
  const availabilityScore = input.isAvailable ? 1 : 0;

  let priceValueScore = 0.5;
  if (input.categoryMedianPrice > 0) {
    const ratio = input.price / input.categoryMedianPrice;
    // Cheaper-than-median scores higher, but capped so it never dominates rating/trust
    priceValueScore = Math.min(1, Math.max(0, 1 - (ratio - 1)));
  }

  const score =
    proximityScore * WEIGHTS.proximity +
    ratingScore * WEIGHTS.rating +
    verifiedScore * WEIGHTS.verified +
    availabilityScore * WEIGHTS.availability +
    priceValueScore * WEIGHTS.priceValue;

  return Math.round(score * 1000) / 1000;
}
