"use client";

import { LifeBuoy, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SupportPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <LifeBuoy size={28} className="mx-auto text-primary" />
      <h1 className="mt-4 text-2xl font-semibold text-ink">Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Had an issue with an order? Reach out and our team will help you sort it out.
      </p>

      <div className="mt-8 flex flex-col gap-3 text-sm">
        <a href="mailto:support@cityserve.app" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-ink hover:bg-secondary/30 transition">
          <Mail size={16} className="text-primary" /> support@cityserve.app
        </a>
        <a href="tel:+911234567890" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-ink hover:bg-secondary/30 transition">
          <Phone size={16} className="text-primary" /> +91 12345 67890
        </a>
      </div>

      {user ? (
        <p className="mt-6 text-xs text-muted-foreground">
          Have an order in question? You can also check its status from{" "}
          <Link href="/dashboard/orders" className="font-medium text-primary">your orders</Link>.
        </p>
      ) : (
        <p className="mt-6 text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary">Log in</Link> to view your orders.
        </p>
      )}
    </div>
  );
}
