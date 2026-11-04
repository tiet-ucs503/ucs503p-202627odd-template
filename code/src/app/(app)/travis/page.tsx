import type { Metadata } from "next";
import { TravisChat } from "@/components/travis/travis-chat";
import { COUNTRIES } from "@/lib/countries";

export const metadata: Metadata = {
  title: "Ask Travis · TripEase",
};

export default function TravisPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Ask Travis
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Not sure where to go, or when? Talk it through, then turn a suggestion into a trip. Travis suggests from
          the {COUNTRIES.length} countries TripEase plans trips to.
        </p>
      </header>
      <TravisChat />
    </div>
  );
}
