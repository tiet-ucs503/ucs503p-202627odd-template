"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.get<any>("/admin/users").then((res) => setUsers(res.users)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(id: string) {
    await api.patch(`/admin/users/${id}/toggle-active`);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-ink">{u.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
              <td className="px-4 py-3">
                <span className={u.isActive ? "text-primary" : "text-red-600"}>{u.isActive ? "Active" : "Suspended"}</span>
              </td>
              <td className="px-4 py-3">
                <Button size="sm" variant="outline" onClick={() => toggle(u.id)}>
                  {u.isActive ? "Suspend" : "Reactivate"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
