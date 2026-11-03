"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />
      <Link
        href="/"
        className="font-display mb-8 text-xl font-semibold tracking-tight"
      >
        Trip<span className="text-orange-600">Ease</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
