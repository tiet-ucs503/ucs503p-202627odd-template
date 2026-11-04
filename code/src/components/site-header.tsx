"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { signOutUser } from "@/lib/services/auth";
import { clearAllConversations } from "@/lib/travis-storage";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * The two places a traveller works from. A trip page (`/trips/…`) belongs to
 * "Trips", so that section stays marked while one is open.
 */
const NAV = [
  { href: "/dashboard", label: "Trips", matches: ["/dashboard", "/trips"] },
  { href: "/travis", label: "Travis", matches: ["/travis"] },
] as const;

function isActive(pathname: string, matches: readonly string[]): boolean {
  return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function SiteHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      // A tab can outlive a person. Whatever was said to Travis should not be
      // waiting for the next account that signs in here.
      clearAllConversations();
      router.replace("/sign-in");
    } catch {
      // Signing out failed (usually the network), so the person is still
      // signed in. The button returns to "Sign out" and they can try again;
      // there is nothing useful to throw to, and their conversation is kept.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight">
            Trip<span className="text-orange-600">Ease</span>
          </Link>

          {user ? (
            <nav aria-label="Main" className="flex items-center gap-0.5">
              {NAV.map((item) => {
                const active = isActive(pathname, item.matches);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // Colour alone shouldn't say where you are, so the current
                    // section is also announced to assistive technology.
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600",
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/trips/new" className="hidden sm:block">
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5" />
                  New trip
                </Button>
              </Link>
              <span className="hidden text-zinc-500 lg:inline">
                {user.displayName || user.email}
              </span>
              <ThemeToggle />

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
