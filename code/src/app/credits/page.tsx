import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

export const metadata: Metadata = {
  title: "Photo credits · TripEase",
};

export default function CreditsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="font-display text-lg font-semibold tracking-tight">
        Trip<span className="text-orange-600">Ease</span>
      </Link>

      <h1 className="font-display mt-10 text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
        Photo credits
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The photographs in TripEase are from Wikimedia Commons and are used under the licences below.
        They have been resized and cropped to fit.
      </p>

      <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.slug} className="flex flex-col gap-0.5 py-4">
            <a
              href={credit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
            >
              {credit.subject}
            </a>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Photo by {credit.photographer} ·{" "}
              <a
                href={credit.licenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {credit.licence}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
