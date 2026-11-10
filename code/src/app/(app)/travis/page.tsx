import type { Metadata } from "next";
import { TravisAvatar } from "@/components/travis/travis-avatar";
import { TravisChat } from "@/components/travis/travis-chat";
import { COUNTRIES } from "@/lib/countries";

export const metadata: Metadata = {
  title: "Ask Travis · TripEase",
};

export default function TravisPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <TravisAvatar size="lg" />
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            Ask Travis
          </h1>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            Where and when to go, from the {COUNTRIES.length} countries TripEase plans trips to.
          </p>
        </div>
      </header>
      <TravisChat />
    </div>
  );
}
