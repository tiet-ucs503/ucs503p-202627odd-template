"use client";

import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function ProfilePage() {
  const { user, loading, refreshMe } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setAddress(user.address ?? "");
      setCity(user.city ?? "");
    }
  }, [user]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch("/auth/me", { name, phone, address, city });
      await refreshMe();
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : "Couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <Spinner />;

  return (
    <div className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <input value={user.email} disabled className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Default address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink" />
          <p className="mt-1 text-xs text-muted-foreground">Used to pre-fill checkout — you can always edit it per order.</p>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        <Button onClick={handleSave} disabled={saving} className="w-fit">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
