"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badge";
import { formatINR, formatDate } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";
import type { Order, OrderStatus } from "@/types";

const FILTER_TABS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");

  function load() {
    setLoading(true);
    api.get<Order[]>("/vendors/my/orders").then(setOrders).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: OrderStatus) {
    setProcessing(id + status);
    try {
      await api.patch(`/vendors/my/orders/${id}/status`, { status });
      load();
    } finally {
      setProcessing(null);
    }
  }

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending", status: "PENDING" as OrderStatus, icon: Clock, color: "text-orange-500" },
          { label: "Approved", status: "APPROVED" as OrderStatus, icon: CheckCircle2, color: "text-blue-500" },
          { label: "Completed", status: "COMPLETED" as OrderStatus, icon: CheckCircle2, color: "text-green-500" },
          { label: "Rejected", status: "REJECTED" as OrderStatus, icon: XCircle, color: "text-red-500" },
        ].map((s) => (
          <button
            key={s.status}
            onClick={() => setFilter(s.status)}
            className={`rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary ${filter === s.status ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <s.icon size={20} className={s.color} />
            <p className="text-xl font-bold text-foreground mt-1">
              {orders.filter((o) => o.status === s.status).length}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${filter === f.value ? "bg-primary text-white shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-border"
              }`}
          >
            {f.label}
            {f.value !== "ALL" && (
              <span className="ml-1.5 opacity-70">({orders.filter((o) => o.status === f.value).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Order cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ShoppingBag size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">No {filter !== "ALL" ? filter.toLowerCase() : ""} orders</p>
          <p className="text-xs text-muted-foreground mt-1">Orders from customers will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {o.Offering?.name ?? "Order"}{" "}
                    <span className="font-normal text-muted-foreground">× {o.quantity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.customer?.name && <>{o.customer.name} · </>}
                    {o.orderNumber} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-xs rounded-xl bg-secondary/40 p-3">
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold text-foreground">{formatINR(o.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <p className="font-semibold text-foreground capitalize">{o.paymentStatus}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-semibold text-foreground capitalize">{o.type}</p>
                </div>
                {o.scheduledAt && (
                  <div>
                    <p className="text-muted-foreground">Scheduled</p>
                    <p className="font-semibold text-foreground">{formatDate(o.scheduledAt)}</p>
                  </div>
                )}
              </div>

              {o.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle size={11} /> {o.address}
                </p>
              )}

              {o.customerNote && (
                <div className="rounded-lg bg-accent/60 p-2.5 text-xs text-accent-foreground">
                  <span className="font-semibold">Note: </span>{o.customerNote}
                </div>
              )}

              {/* Action buttons */}
              {o.status === "PENDING" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => updateStatus(o.id, "APPROVED")}
                    disabled={processing !== null}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50 transition"
                  >
                    <CheckCircle2 size={14} />
                    {processing === o.id + "APPROVED" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => updateStatus(o.id, "REJECTED")}
                    disabled={processing !== null}
                    className="flex items-center gap-1.5 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive hover:text-white disabled:opacity-50 transition"
                  >
                    <XCircle size={14} />
                    {processing === o.id + "REJECTED" ? "Rejecting…" : "Reject"}
                  </button>
                </div>
              )}

              {o.status === "APPROVED" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => updateStatus(o.id, "COMPLETED")}
                    disabled={processing !== null}
                    className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    <CheckCircle2 size={14} />
                    {processing === o.id + "COMPLETED" ? "Completing…" : "Mark as Completed"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
