"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/Badge";
import type { Order } from "@/types";

export default function VendorDashboardOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Order[]>("/vendors/my/orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const pending = orders.filter((o) => o.status === "PENDING");
  const approved = orders.filter((o) => o.status === "APPROVED");
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const revenue = completed.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "bg-blue-500/10 text-blue-500" },
          { label: "Pending", value: pending.length, icon: Clock, color: "bg-orange-500/10 text-orange-500" },
          { label: "Completed", value: completed.length, icon: CheckCircle, color: "bg-green-500/10 text-green-500" },
          { label: "Revenue", value: formatINR(revenue), icon: TrendingUp, color: "bg-primary/10 text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.color} mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending orders needing attention */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Needs Attention</h2>
          <Link href="/partner-dashboard/orders" className="text-xs font-semibold text-primary hover:underline">
            View all orders →
          </Link>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <CheckCircle size={28} className="mx-auto text-green-500 mb-2" />
            <p className="text-sm font-semibold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No pending orders require approval.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                href="/partner-dashboard/orders"
                className="flex items-center justify-between rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 p-4 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {o.Offering?.name ?? "Order"} · <span className="font-normal text-muted-foreground">{o.orderNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatINR(o.totalAmount)}</p>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Recent Completed</h2>
          <div className="flex flex-col gap-2">
            {completed.slice(0, 3).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{o.Offering?.name ?? "Order"}</p>
                  <p className="text-xs text-muted-foreground">{formatINR(o.totalAmount)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
