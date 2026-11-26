/**
 * Placeholder with the same shape as a `StreamCard`, shown while a list loads so
 * the grid doesn't jump when the real cards arrive. Pulses unless the user has
 * asked for reduced motion.
 */
export function CardSkeleton() {
  return (
    <div className="card flex flex-col gap-4 animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-border" />
          <div className="h-4 w-28 rounded bg-border" />
        </div>
        <div className="h-5 w-16 rounded-full bg-border" />
      </div>

      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-6 w-36 rounded bg-border" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-24 rounded bg-border" />
        <div className="h-8 w-20 rounded-lg bg-border" />
      </div>
    </div>
  );
}

/** Renders `count` skeleton cards in the same grid the list pages use for real cards. */
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading streams"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
