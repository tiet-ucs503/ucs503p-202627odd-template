"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A panel that docks to the right edge.
 *
 * Unlike `Dialog` it is not modal: there is no overlay, nothing behind it is
 * made inert, and clicking the page does not close it. That is the point. It
 * holds a conversation about the page next to it, so the page has to stay
 * readable and usable while it is open. Escape and the close button close it.
 * On a phone it takes the whole screen, since there is no "next to it".
 */
export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      {children}
    </RadixDialog.Root>
  );
}

export function SheetContent({
  title,
  description,
  children,
  className,
  headerExtra,
  icon,
}: {
  title: string;
  /** Read by screen readers; not drawn. */
  description: string;
  children: ReactNode;
  className?: string;
  /** Controls placed beside the close button. */
  headerExtra?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Content
        // Clicking the page behind is allowed and must not close the panel.
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(
          "animate-fade-in fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-zinc-200 bg-background shadow-2xl focus:outline-none sm:w-[26rem] dark:border-zinc-800",
          className,
        )}
      >
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {icon}
          <div className="min-w-0 flex-1">
            <RadixDialog.Title className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">{description}</RadixDialog.Description>
          </div>
          {headerExtra}
          <RadixDialog.Close
            className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
