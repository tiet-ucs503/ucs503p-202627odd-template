"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import type { Category } from "@/types";

export default function PartnerProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", unit: "litre", categoryId: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<any>("/partners/me/profile").then((profile) => {
      api.get<any>(`/catalog/products?partnerId=${profile.id}&pageSize=50`).then((res) => setProducts(res.products));
    });
    api.get<Category[]>("/categories").then((cats) => {
      setCategories(cats);
      if (cats[0]) setForm((f) => ({ ...f, categoryId: cats[0].id }));
    });
    setLoading(false);
  }
  useEffect(load, []);

  async function handleCreate() {
    setError(null);
    try {
      await api.post("/catalog/products", { ...form, price: Number(form.price) });
      setCreating(false);
      setForm({ name: "", price: "", unit: "litre", categoryId: categories[0]?.id ?? "", description: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't create product.");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> Add product
        </Button>
      </div>

      {creating && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Unit (e.g. litre, kg)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <Button onClick={handleCreate} className="mt-3">Save product</Button>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your first product to start selling." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-ink">{p.name}</p>
              <p className="text-xs text-muted-foreground">{formatINR(p.price)} / {p.unit} · {p.stockQty} in stock</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
