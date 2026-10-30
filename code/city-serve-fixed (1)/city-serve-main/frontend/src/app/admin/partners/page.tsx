"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { VerifiedBadge } from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import type { Vendor } from "@/types";

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<(Vendor & { User?: { email: string; phone: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get<any>("/admin/vendors?pageSize=500").then((res) => setVendors(res.vendors)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleVerify(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/admin/vendors/${id}/verify`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner />;

  const verifiedCount = vendors.filter((v) => v.isVerified).length;

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {vendors.length} total vendors · {verifiedCount} verified · {vendors.length - verifiedCount} pending
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink">{v.businessName}</td>
                <td className="px-4 py-3 text-muted-foreground">{v.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{v.city ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{(v as any).User?.email ?? (v as any).User?.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  {v.isVerified ? <VerifiedBadge /> : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">Pending</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleVerify(v.id)}
                    disabled={busyId === v.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-secondary/40 disabled:opacity-50 transition"
                  >
                    {busyId === v.id ? "…" : v.isVerified ? "Unverify" : "Verify"}
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No vendors yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
