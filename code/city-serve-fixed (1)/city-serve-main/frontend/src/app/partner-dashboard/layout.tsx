"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Package, Wrench } from "lucide-react";

const TABS = [
  { href: "/partner-dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/partner-dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/partner-dashboard/products", label: "Products", icon: Package },
  { href: "/partner-dashboard/services", label: "Services", icon: Wrench },
];

export default function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Vendor Dashboard</h1>
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/partner-dashboard" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
