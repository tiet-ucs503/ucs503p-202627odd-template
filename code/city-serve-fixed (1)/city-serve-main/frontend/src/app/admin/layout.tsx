"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Users, Building2 } from "lucide-react";

const TABS = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/partners", label: "Vendors", icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold text-ink">Admin Panel</h1>
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium ${
                active ? "border-primary text-ink" : "border-transparent text-muted-foreground hover:text-ink"
              }`}
            >
              <tab.icon size={15} /> {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
