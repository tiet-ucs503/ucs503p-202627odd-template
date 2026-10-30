export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="h-36 animate-pulse bg-gradient-to-br from-secondary/25 to-background" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-border/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-border/50" />
            <div className="h-3 w-full animate-pulse rounded bg-border/40" />
            <div className="flex justify-between pt-1">
              <div className="h-3 w-16 animate-pulse rounded bg-border/50" />
              <div className="h-3 w-12 animate-pulse rounded bg-border/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
