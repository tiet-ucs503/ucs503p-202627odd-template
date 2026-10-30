"use client";

import Link from "next/link";
import { ShieldCheck, Package, ShoppingBag, Heart } from "lucide-react";
import MediaTile from "./ui/MediaTile";
import { formatINR } from "@/lib/format";
import type { Offering } from "@/types";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

export default function ProductCard({ product }: { product: Offering }) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [isFav, setIsFav] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addItem(product, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // handled in context
    } finally {
      setAdding(false);
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFav((f) => !f);
  };

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-cardHover"
    >
      <div className="relative">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <MediaTile icon={Package} className="h-36 bg-gradient-to-br from-secondary to-accent/30" size={24} />
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

        {/* Stock tag */}
        {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-orange-500/90 backdrop-blur-md text-[10px] font-bold text-white">
            Only {product.stock} left
          </span>
        )}

        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-card/90 backdrop-blur-md text-[10px] font-semibold text-primary uppercase tracking-wider">
          Product
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-semibold text-sm leading-snug text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
          {product.name}
        </p>

        {product.vendor && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {product.vendor.isVerified && (
              <ShieldCheck size={12} className="shrink-0 text-primary" />
            )}
            <span className="truncate">{product.vendor.businessName}</span>
          </p>
        )}

        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50">
          <div>
            <p className="text-sm font-bold text-foreground">
              {product.price != null ? formatINR(product.price) : "—"}
              {product.unit && (
                <span className="text-[11px] font-normal text-muted-foreground"> / {product.unit}</span>
              )}
            </p>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={adding}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 ${added
                ? "bg-green-500 text-white scale-105"
                : "bg-primary text-white hover:bg-primary-hover"
              }`}
          >
            <ShoppingBag size={13} />
            <span>{adding ? "…" : added ? "Added!" : "Add"}</span>
          </button>
        </div>
      </div>
    </Link>
  );
}
