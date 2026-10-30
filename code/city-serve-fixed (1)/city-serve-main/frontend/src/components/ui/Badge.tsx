import { ShieldCheck, Database, MapPin } from "lucide-react";
import clsx from "clsx";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary border border-primary/20",
        className
      )}
    >
      <ShieldCheck size={12} strokeWidth={2.25} className="text-primary" />
      Verified Partner
    </span>
  );
}

export function DirectoryBadge({ className, source }: { className?: string; source?: string | null }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border",
        className
      )}
      title={source ? `Sourced from: ${source}` : "Directory listing. Not independently verified by CityServe."}
    >
      <Database size={11} strokeWidth={2} />
      Directory Listing
    </span>
  );
}

// Backward-compat alias
export const ImportedBadge = DirectoryBadge;

export function LocalityBadge({ locality, className }: { locality: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/60",
        className
      )}
    >
      <MapPin size={11} className="text-primary shrink-0" />
      <span className="truncate max-w-[140px]">{locality}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    COMPLETED: "bg-primary text-white border border-primary",
    REJECTED: "bg-destructive/10 text-destructive border border-destructive/20",
    CANCELLED: "bg-destructive/10 text-destructive border border-destructive/20",
  };
  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide", map[status] ?? "bg-secondary text-secondary-foreground")}>
      {status}
    </span>
  );
}

