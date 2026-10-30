"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Package, Star, XCircle } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import type { Order } from "@/types";

const ORDER_STEPS = ["PENDING", "APPROVED", "COMPLETED"];

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  function load() {
    api.get<Order>(`/orders/${params.id}`).then(setOrder).catch(() => setOrder(null)).finally(() => setLoading(false));
  }
  useEffect(load, [params.id]);

  async function submitReview() {
    setSubmittingReview(true);
    setReviewMsg(null);
    try {
      await api.post("/reviews", { orderId: params.id, rating, comment });
      setReviewMsg("Thanks for your review!");
      load();
    } catch (err) {
      setReviewMsg(err instanceof ApiRequestError ? err.message : "Couldn't submit review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <Spinner />;
  if (!order) return <EmptyState icon={Package} title="Order not found" />;

  const isTerminalNegative = order.status === "CANCELLED" || order.status === "REJECTED";
  const currentIdx = isTerminalNegative ? -1 : ORDER_STEPS.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Order {order.orderNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{order.vendor?.businessName ?? "Order"}</h1>
          <p className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {isTerminalNegative ? (
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <XCircle size={18} />
          This order was {order.status.toLowerCase()}.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-0">
          {ORDER_STEPS.map((step, i) => (
            <div key={step} className="flex gap-4">
              <div className="flex flex-col items-center">
                {i <= currentIdx ? (
                  <CheckCircle2 size={22} className="text-primary" />
                ) : (
                  <Circle size={22} className="text-border" />
                )}
                {i < ORDER_STEPS.length - 1 && <div className={`h-10 w-0.5 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />}
              </div>
              <p className={`pb-8 text-sm ${i <= currentIdx ? "font-medium text-ink" : "text-muted-foreground"}`}>
                {step}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-medium text-ink">Order details</p>
        <div className="mt-3 flex justify-between text-sm text-muted-foreground">
          <span>{order.Offering?.name ?? "Item"} × {order.quantity}</span>
          <span className="text-ink">{formatINR(order.totalAmount)}</span>
        </div>
        {order.scheduledAt && (
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>Scheduled</span>
            <span className="text-ink">{formatDate(order.scheduledAt)}</span>
          </div>
        )}
        {order.address && (
          <div className="mt-2 flex justify-between text-sm text-muted-foreground gap-4">
            <span>Address</span>
            <span className="text-ink text-right">{order.address}</span>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold text-ink">
          <span>Total</span><span>{formatINR(order.totalAmount)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Payment: {order.paymentStatus} (demo payment — no real money was charged)</p>
      </div>

      {order.status === "COMPLETED" && !order.review && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-ink">Rate your experience</p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star size={22} className={n <= rating ? "fill-primary text-primary" : "text-border"} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell others about your experience (optional)" rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink" />
          {reviewMsg && <p className="mt-2 text-sm text-primary">{reviewMsg}</p>}
          <Button onClick={submitReview} disabled={submittingReview} className="mt-3">
            {submittingReview ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      )}
      {order.review && <p className="mt-6 text-sm text-primary">You've already reviewed this order. Thank you!</p>}
    </div>
  );
}
