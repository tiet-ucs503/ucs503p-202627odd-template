import { cn } from "@/lib/utils";

/**
 * Who is speaking. A plain monogram in the brand colour: Travis is an
 * assistant, not a character, so there is no face or mascot to look at.
 * Decorative: every turn is announced to a screen reader in words instead.
 */
export function TravisAvatar({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-orange-600 font-display font-medium leading-none text-white",
        size === "lg" ? "h-12 w-12 text-2xl" : "h-8 w-8 text-base",
        className,
      )}
    >
      T
    </div>
  );
}
