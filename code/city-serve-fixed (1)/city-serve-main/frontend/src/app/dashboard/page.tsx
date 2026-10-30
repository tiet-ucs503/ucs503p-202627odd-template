"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badge";
import { formatINR, formatDate } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";
import type { Order } from "@/types";

export default function DashboardOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Order[]>("/orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const activeOrders = orders.filter((o) => o.status === "PENDING" || o.status === "APPROVED");
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");
  const pendingOrders = orders.filter((o) => o.status === "PENDING");

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-2xl font-bold text-foreground">{activeOrders.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Active Orders</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-2xl font-bold text-foreground">{pendingOrders.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Pending Approval</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-2xl font-bold text-foreground">{completedOrders.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Completed</p>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No orders yet. Start by exploring products & services.</p>
            <Link
              href="/explore"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover transition"
            >
              Explore Now
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {o.vendor?.businessName && <span className="text-primary">{o.vendor.businessName}</span>}
                    {o.vendor?.businessName && " · "}
                    {o.orderNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(o.createdAt)} · {formatINR(o.totalAmount)}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
