"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, MapPin } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/format";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { items, subtotal, loading, clearCart } = useCart();
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.address) setAddress(user.address);
  }, [user]);

  async function handlePlaceOrder() {
    if (!address.trim()) {
      setError("Please enter a delivery address.");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      // Order model is single-offering, so a multi-item cart becomes one
      // order per line item — each still goes through the same PENDING →
      // vendor-approval workflow.
      let lastOrderId: string | null = null;
      for (const item of items) {
        const order = await api.post<any>("/orders", {
          offeringId: item.offeringId,
          quantity: item.quantity,
          address,
        });
        lastOrderId = order.id;
      }
      await clearCart();
      router.push(lastOrderId ? `/orders/${lastOrderId}` : "/dashboard/orders");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't place your order.");
    } finally {
      setPlacing(false);
    }
  }

  if (authLoading || loading) return <Spinner />;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState icon={CreditCard} title="Your cart is empty" description="Add items to your cart before proceeding to checkout." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm your delivery address and place your order</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-border/60 pb-3">
          <MapPin size={16} className="text-primary" />
          <span>Delivery Address</span>
        </div>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Enter your delivery address"
          className="w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
        <h2 className="font-bold text-foreground text-sm border-b border-border/60 pb-3">Order Summary</h2>

        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {items.map((i) => (
            <li key={i.offeringId} className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{i.offering.name} × {i.quantity}</span>
              <span className="font-semibold text-foreground shrink-0">{formatINR(Number(i.offering.price ?? 0) * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border/60 pt-3 flex justify-between text-sm font-extrabold text-foreground">
          <span>Total</span>
          <span className="text-primary">{formatINR(subtotal)}</span>
        </div>

        <div className="rounded-xl bg-accent p-3 text-xs text-accent-foreground flex items-center gap-2 font-medium">
          <CreditCard size={16} className="shrink-0" />
          <span>Demo payment mode — no real money is charged.</span>
        </div>

        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

        <Button onClick={handlePlaceOrder} disabled={placing} className="w-full py-3 text-xs font-bold shadow-sm">
          {placing ? "Placing Order…" : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
