"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Minus, Plus, PackageSearch } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import RatingStars from "@/components/ui/RatingStars";
import { VerifiedBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import type { Offering, Review } from "@/types";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<Offering | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api
      .get<Offering>(`/catalog/products/${params.id}`)
      .then((p) => {
        setProduct(p);
        if (p.vendor?.id) {
          api
            .get<Review[]>(`/reviews/vendor/${p.vendor.id}`)
            .then((all) => setReviews(all.filter((r) => r.offeringId === p.id)))
            .catch(() => {});
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleAddToCart() {
    if (!product) return;
    setAdding(true);
    try {
      await addItem(product, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      // addItem is local/synchronous in practice; kept for future API errors
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <Spinner />;
  if (!product) return <EmptyState icon={PackageSearch} title="Product not found" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-background text-lg text-primary/60">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            product.name
          )}
        </div>

        <div>
          {product.vendor && (
            <Link
              href={`/vendor/${product.vendor.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {product.vendor.isVerified && <ShieldCheck size={14} className="text-primary" />}
              <span>{product.vendor.businessName}</span>
            </Link>
          )}
          <h1 className="mt-1 text-2xl sm:text-3xl font-serif text-foreground font-bold">{product.name}</h1>
          {product.vendor?.isVerified && <VerifiedBadge className="mt-2" />}

          <p className="mt-4 text-2xl font-bold text-foreground">
            {product.price != null ? formatINR(product.price) : "—"}
            {product.unit && <span className="text-sm font-normal text-muted-foreground"> / {product.unit}</span>}
          </p>

          {product.description && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-border bg-secondary/30">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-2.5 text-muted-foreground hover:text-foreground transition"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-xs font-bold text-foreground">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(50, q + 1))}
                className="p-2.5 text-muted-foreground hover:text-foreground transition"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
            <Button
              onClick={handleAddToCart}
              disabled={adding || product.isAvailable === false}
              className="flex-1 py-2.5 text-xs font-bold shadow-subtle"
            >
              {adding ? "Adding…" : added ? "Added to Cart!" : "Add to Cart"}
            </Button>
          </div>
          {product.stock !== undefined && (
            <p className="mt-3 text-xs text-muted-foreground">{product.stock} available in stock</p>
          )}
        </div>

      </div>

      <section className="mt-14">
        <h2 className="text-lg font-medium text-ink">Reviews ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No reviews yet for this product.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{r.customer?.name ?? "Customer"}</p>
                  <RatingStars rating={r.rating} size={12} />
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
