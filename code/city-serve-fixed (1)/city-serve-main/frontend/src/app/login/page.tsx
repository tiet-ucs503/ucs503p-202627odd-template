"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import { ApiRequestError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground font-bold">Welcome back</h1>
          <p className="mt-1 text-xs text-muted-foreground">Log in to manage your orders, services, and account.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="student@thapar.demo"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground" htmlFor="password">
                Password
              </label>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} loading={loading} className="mt-2 w-full py-2.5 text-xs font-bold shadow-subtle">
            Log In
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/60">
          Don't have an account?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>

        <div className="rounded-xl bg-muted/60 p-3 text-center text-[11px] text-muted-foreground border border-border/40 space-y-1">
          <p className="font-semibold text-foreground">Demo Accounts:</p>
          <p>Customer: student@thapar.demo / Student@123</p>
          <p>Admin: admin@cityserve.demo / Admin@123</p>
        </div>
      </div>
    </div>
  );
}

