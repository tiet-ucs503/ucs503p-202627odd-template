"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badge";
import { formatINR, formatDate } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";
import type { Order, OrderStatus } from "@/types";

const STATUS_FILTERS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");

  useEffect(() => {
    api.get<Order[]>("/orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${filter === f.value
                ? "bg-primary text-white shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-border"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Package size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">No orders found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "ALL" ? "Once you place an order, it'll show up here." : `No ${filter.toLowerCase()} orders.`}
          </p>
          {filter === "ALL" && (
            <Link
              href="/explore"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover transition"
            >
              Explore Products & Services
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition group"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Package size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">
                    {o.Offering?.name ?? "Order"} · <span className="font-normal text-muted-foreground">{o.orderNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.vendor?.businessName && `${o.vendor.businessName} · `}
                    {formatDate(o.createdAt)} · {formatINR(o.totalAmount)}
                  </p>
                </div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
