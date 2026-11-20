"use client";

import { useEffect, useState } from "react";
import { formatTimeUntil } from "@/lib/format";

/** How often the countdown re-renders. Minute-level text does not need per-second updates. */
export const COUNTDOWN_TICK_MS = 30_000;

export interface StartsInCountdownProps {
  /** Unix ms timestamp of the stream start, derived from its estimated start ledger. */
  startTime: number;
  className?: string;
}

/**
 * "Starts in 2h 5m (estimated)" for a scheduled stream. The time is derived
 * from the estimated ledger close time, so it is always labelled as an
 * estimate. Renders nothing once the start has passed or when the time is
 * unknown, rather than showing a made-up value. No live region is used, so
 * screen readers are not interrupted by updates.
 */
export function StartsInCountdown({ startTime, className = "" }: StartsInCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [startTime]);

  const remaining = formatTimeUntil(startTime, now);
  if (remaining === null) return null;

  return (
    <span className={className} title="Estimated from the ledger close time, so it can drift slightly">
      Starts in {remaining} <span className="text-muted">(estimated)</span>
    </span>
  );
}
