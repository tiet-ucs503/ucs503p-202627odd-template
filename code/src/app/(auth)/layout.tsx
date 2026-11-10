"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { bestMonthsLabel, countryByCode } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";

/**
 * The photograph and the line beside it differ by page, so signing up and
 * signing in don't feel like the same screen twice.
 */
const SIDE = {
  signUp: { code: "NZ", line: "Plan the whole trip in one place.", detail: "Pick a country and TripEase builds the days." },
  signIn: { code: "JP", line: "Your trips, just as you left them.", detail: "Sign in to pick up where you stopped." },
} as const;

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={className}>
      <span className="font-display text-xl font-semibold tracking-tight">
        Trip<span className="text-orange-400">Ease</span>
      </span>
    </Link>
  );
}

/**
 * Where people sign in or sign up. From a laptop it is the form beside a
 * photograph; on a phone the photograph becomes a banner above it, so the form
 * is never pushed below the fold.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const side = pathname.startsWith("/sign-up") ? SIDE.signUp : SIDE.signIn;
  const country = countryByCode(side.code);
  const photo = photoForCountry(side.code);

  return (
    <div className="flex min-h-svh flex-1 flex-col lg:flex-row">
      {/* A phone: a short banner. Hidden from a laptop, which has the pane. */}
      <div className="relative isolate h-40 shrink-0 overflow-hidden bg-zinc-900 text-white lg:hidden">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="100vw"
          loading="lazy"
          style={{ objectPosition: photo.position }}
          className="-z-20 object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/10 to-black/55" />
        <Logo className="absolute left-5 top-5 text-white" />
        <ThemeToggle onPhoto className="absolute right-4 top-4" />
      </div>

      <aside className="relative isolate hidden overflow-hidden bg-zinc-900 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12 xl:w-[55%]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1280px) 55vw, 50vw"
          loading="lazy"
          style={{ objectPosition: photo.position }}
          className="-z-20 object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/15 to-black/40" />

        <Logo className="w-fit" />

        <div>
          <p className="font-display max-w-md text-4xl font-medium leading-tight tracking-tight xl:text-5xl">
            {side.line}
          </p>
          <p className="mt-3 max-w-sm text-white/85">{side.detail}</p>
          {country ? (
            <p className="mt-8 text-xs text-white/75">
              <span className="font-medium text-white">{country.name}</span> · usually best {bestMonthsLabel(country)}
            </p>
          ) : null}
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col">
        <ThemeToggle className="absolute right-6 top-6 z-10 hidden lg:inline-flex" />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-10 pt-10 sm:pt-14 lg:pt-[16vh]">
          {children}
        </main>
      </div>
    </div>
  );
}
