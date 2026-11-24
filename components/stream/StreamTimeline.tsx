"use client";

import { useEffect, useState } from "react";
import type { LedgerSnapshot } from "@/lib/stellar";
import { estimateCurrentLedger } from "@/lib/streaming";
import { useLedgerSnapshot } from "@/hooks/useLedgerSnapshot";
import { format } from "date-fns";
import { TICK_MS } from "@/lib/constants";

export interface StreamTimelineProps {
  startLedger: number;
  endLedger: number;
  cliffLedger?: number;
  startTime?: number;
  endTime?: number;
  cliffTime?: number;
  simulatedReference?: LedgerSnapshot;
  enabled?: boolean;
}

/** Visual bar showing start / optional cliff / live "now" marker / end. */
export function StreamTimeline({
  startLedger,
  endLedger,
  cliffLedger,
  startTime,
  endTime,
  cliffTime,
  simulatedReference,
  enabled = true,
}: StreamTimelineProps) {
  const { snapshot, isLoading, error } = useLedgerSnapshot({ enabled, simulatedReference });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !snapshot) return;
    const tickInterval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tickInterval);
  }, [enabled, snapshot]);

  const currentLedger = snapshot
    ? enabled
      ? estimateCurrentLedger({ lastKnownLedger: snapshot.ledger, lastKnownLedgerTimestampMs: snapshot.timestampMs })
      : snapshot.ledger
    : null;

  const total = Math.max(1, endLedger - startLedger);
  const pct = (ledger: number) => Math.min(100, Math.max(0, ((ledger - startLedger) / total) * 100));

  const nowPct = currentLedger === null ? null : pct(currentLedger);
  const cliffPct = cliffLedger !== undefined ? pct(cliffLedger) : null;

  const nowPctRounded = nowPct === null ? null : Math.floor(nowPct);
  const cliffPctRounded = cliffPct !== null ? Math.floor(cliffPct) : null;
  const ariaLabel =
    nowPctRounded === null
      ? "Stream timeline"
      : cliffPctRounded !== null
        ? `Stream is ${nowPctRounded}% through; cliff at ${cliffPctRounded}%`
        : `Stream is ${nowPctRounded}% through`;

  return (
    <div className="w-full">
      <div className="relative h-3 w-full rounded-full bg-border" role="img" aria-label={ariaLabel}>
        {nowPct !== null && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${nowPct}%` }} />
        )}
        {cliffPct !== null && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-warning"
            style={{ left: `${cliffPct}%` }}
            title="Cliff"
          />
        )}
        {nowPct !== null && (
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left: `${nowPct}%` }}
          title="Now"
        />
        )}
      </div>
      {snapshot === null && (
        <p role="status" className="mt-2 text-xs text-muted">
          {isLoading ? "Loading stream progress…" : error ? "Unable to load ledger data." : "Ledger data unavailable."}
        </p>
      )}
      <div className="mt-2 flex justify-between text-xs text-muted">
        <TimelineLabel label="Start" time={startTime} />
        {cliffTime !== undefined && cliffLedger !== undefined && <TimelineLabel label="Cliff" time={cliffTime} />}
        <TimelineLabel label="End" time={endTime} />
      </div>
    </div>
  );
}

function TimelineLabel({ label, time }: { label: string; time?: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-white/70">{label}</span>
      {time !== undefined && time > 0 && <span>{format(time, "MMM d, HH:mm")}</span>}
    </div>
  );
}
