"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/format";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, subtotal, loading, updateItem, removeItem } = useCart();
  const router = useRouter();

  if (authLoading || loading) return <Spinner />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse local products and add a few to your cart."
          action={
            <Link href="/explore">
              <Button>Browse Products</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Your Cart</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.offeringId}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/40 transition"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-primary font-bold text-base overflow-hidden">
                {item.offering.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.offering.imageUrl} alt={item.offering.name} className="h-full w-full object-cover" />
                ) : (
                  item.offering.name.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-card-foreground truncate">{item.offering.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatINR(item.offering.price ?? 0)} {item.offering.unit ? `/ ${item.offering.unit}` : ""}
                </p>
              </div>

              <div className="flex items-center rounded-xl border border-border bg-secondary/30">
                <button
                  onClick={() => updateItem(item.offeringId, Math.max(1, item.quantity - 1))}
                  className="p-2 text-muted-foreground hover:text-foreground transition"
                  aria-label="Decrease quantity"
                >
                  <Minus size={13} />
                </button>
                <span className="w-8 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                <button
                  onClick={() => updateItem(item.offeringId, item.quantity + 1)}
                  className="p-2 text-muted-foreground hover:text-foreground transition"
                  aria-label="Increase quantity"
                >
                  <Plus size={13} />
                </button>
              </div>

              <p className="w-24 text-right text-sm font-bold text-foreground">
                {formatINR(Number(item.offering.price ?? 0) * item.quantity)}
              </p>

              <button
                onClick={() => removeItem(item.offeringId)}
                className="p-2 text-muted-foreground hover:text-destructive transition rounded-lg"
                aria-label="Remove item"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-base font-bold text-foreground border-b border-border/60 pb-3">Order Summary</h2>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal ({items.length} items)</span>
              <span className="font-semibold text-foreground">{formatINR(subtotal)}</span>
            </div>

            <div className="border-t border-border pt-3 flex justify-between text-base font-extrabold text-foreground">
              <span>Total</span>
              <span className="text-primary">{formatINR(subtotal)}</span>
            </div>

            <Button
              onClick={() => router.push(user ? "/checkout" : "/login")}
              className="w-full py-3 text-xs font-bold shadow-sm"
            >
              Proceed to Checkout <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
