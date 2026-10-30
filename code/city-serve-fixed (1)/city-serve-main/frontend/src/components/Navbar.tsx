"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ShoppingBag, User as UserIcon, Sun, Moon, MapPin, Search, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/services", label: "Services" },
  { href: "/#categories", label: "Categories" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/partner/register", label: "Partner With Us" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 transition-colors duration-200">
      {/* ── 5A: ANNOUNCEMENT STRIP ────────────────────────────────────────── */}
      <div className="bg-primary text-primary-foreground py-1.5 px-4 text-center text-xs font-medium tracking-wide border-b border-primary-deep/20">
        <div className="mx-auto max-w-7xl flex items-center justify-center gap-2">
          <span>Discover trusted local services around Patiala.</span>
          <Link
            href="/explore"
            className="hidden sm:inline-flex items-center gap-1 underline underline-offset-2 opacity-90 hover:opacity-100 font-semibold"
          >
            Explore directory <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* ── MAIN NAVIGATION BAR ───────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

          {/* Brand Wordmark & Location Selector */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-serif font-bold text-lg shadow-subtle transition-transform group-hover:scale-105">
                C
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                  City<span className="text-primary font-serif">Serve</span>
                </span>
                <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase mt-0.5">
                  Patiala
                </span>
              </div>
            </Link>

            {/* Location Selector */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-foreground/80 bg-muted px-3 py-1.5 rounded-full border border-border/60">
              <MapPin size={13} className="text-primary" />
              <span>Patiala, Punjab</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-semibold tracking-wide text-muted-foreground transition hover:text-primary uppercase"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            {/* Search Access */}
            <Link
              href="/explore"
              className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
              title="Search Services & Businesses"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>

            {/* Cart Indicator */}
            {(!user || user.role === "CUSTOMER") && (
              <Link
                href="/cart"
                className="relative p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                aria-label="Cart"
              >
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* User Account / Auth Actions */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <Link
                  href={user.role === "ADMIN" ? "/admin" : user.role === "VENDOR" ? "/partner-dashboard" : "/dashboard"}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary shadow-subtle transition"
                >
                  <UserIcon size={14} className="text-primary" />
                  <span>{user.name.split(" ")[0]}</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive transition px-2 py-1"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-foreground hover:text-primary px-3 py-1.5 transition"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-primary-hover transition"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              className="p-2 text-foreground md:hidden rounded-lg hover:bg-secondary"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {open && (
          <div className="border-t border-border bg-card px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground hover:text-primary py-1.5"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-2 border-t border-border" />

              {user ? (
                <>
                  <Link
                    href={user.role === "ADMIN" ? "/admin" : user.role === "VENDOR" ? "/partner-dashboard" : "/dashboard"}
                    className="text-sm font-semibold text-primary py-1.5"
                    onClick={() => setOpen(false)}
                  >
                    Dashboard ({user.name})
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setOpen(false);
                    }}
                    className="text-left text-sm font-medium text-destructive py-1.5"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href="/login"
                    className="w-full text-center text-sm font-semibold text-foreground py-2.5 border border-border rounded-xl"
                    onClick={() => setOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="w-full text-center text-sm font-semibold text-white bg-primary py-2.5 rounded-xl"
                    onClick={() => setOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

