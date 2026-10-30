"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";

interface Analytics {
  totalUsers: number;
  totalVendors: number;
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  cancellationRate: number;
  popularCategories: { name: string; vendorCount: number; offeringCount: number }[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api.get<Analytics>("/admin/analytics").then(setData);
  }, []);

  if (!data) return <Spinner />;

  const stats = [
    { label: "Total Users", value: data.totalUsers },
    { label: "Total Vendors", value: data.totalVendors },
    { label: "Total Orders", value: data.totalOrders },
    { label: "Completed Orders", value: data.completedOrders },
    { label: "Total Revenue", value: formatINR(data.revenue) },
    { label: "Cancellation Rate", value: `${data.cancellationRate}%` },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-2xl font-semibold text-ink">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-ink">Popular categories</h2>
        <div className="mt-4 flex flex-col gap-2">
          {data.popularCategories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
          {data.popularCategories.map((c) => (
            <div key={c.name} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span className="text-ink">{c.name}</span>
              <span className="text-muted-foreground">{c.vendorCount} vendors · {c.offeringCount} listings</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
