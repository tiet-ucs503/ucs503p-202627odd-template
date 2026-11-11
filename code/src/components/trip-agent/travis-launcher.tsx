"use client";

/**
 * A button that stays in the corner of the trip page, so Travis is one press
 * away from wherever the traveller has scrolled to. It is shown only while the
 * conversation is closed; the conversation has its own close button.
 */
export function TravisLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full bg-orange-600 py-2 pl-2 pr-5 text-sm font-medium text-white shadow-lg shadow-orange-900/25 transition-all hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.98] sm:bottom-6 sm:right-6"
    >
      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-white font-display text-base font-medium leading-none text-orange-600">
        T
      </span>
      Ask Travis
    </button>
  );
}
