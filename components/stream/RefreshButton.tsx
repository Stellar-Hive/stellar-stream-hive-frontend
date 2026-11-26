"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { formatTimeAgo } from "@/lib/format";

/** How often the "Updated …" label re-renders. Coarse on purpose: it is not a live region and needs no per-second updates. */
export const UPDATED_LABEL_TICK_MS = 15_000;

interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading: boolean;
  /** Time (ms) of the last successful fetch. When set, "Updated …" is shown next to the button. */
  lastUpdatedAt?: number | null;
}

/** Re-fetches the stream list on demand, so the indexer catching up doesn't need a page reload. */
export function RefreshButton({ onRefresh, isLoading, lastUpdatedAt }: RefreshButtonProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        aria-busy={isLoading}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? <Spinner size="sm" decorative /> : null}
        Refresh
      </button>
      {lastUpdatedAt != null ? <UpdatedLabel timestamp={lastUpdatedAt} /> : null}
    </div>
  );
}

/**
 * "Updated 30s ago". Not announced by screen readers as it changes, so the
 * polite refresh cadence never interrupts anyone.
 */
export function UpdatedLabel({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), UPDATED_LABEL_TICK_MS);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <span className="text-xs text-muted" title={new Date(timestamp).toLocaleString()}>
      Updated {formatTimeAgo(timestamp, now)}
    </span>
  );
}
