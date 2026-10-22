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
  const sharedReference = useLedgerSnapshot({ enabled: enabled && !simulatedReference });
  const reference: LedgerSnapshot | null = simulatedReference ?? sharedReference;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const tickInterval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tickInterval);
  }, [enabled]);

  const currentLedger = reference
    ? enabled
      ? estimateCurrentLedger({ lastKnownLedger: reference.ledger, lastKnownLedgerTimestampMs: reference.timestampMs })
      : reference.ledger
    : startLedger;

  const total = Math.max(1, endLedger - startLedger);
  const pct = (ledger: number) => Math.min(100, Math.max(0, ((ledger - startLedger) / total) * 100));

  const nowPct = pct(currentLedger);
  const cliffPct = cliffLedger !== undefined ? pct(cliffLedger) : null;

  const nowPctRounded = Math.floor(nowPct);
  const cliffPctRounded = cliffPct !== null ? Math.floor(cliffPct) : null;
  const ariaLabel =
    cliffPctRounded !== null
      ? `Stream is ${nowPctRounded}% through; cliff at ${cliffPctRounded}%`
      : `Stream is ${nowPctRounded}% through`;

  return (
    <div className="w-full">
      <div className="relative h-3 w-full rounded-full bg-border" role="img" aria-label={ariaLabel}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
          style={{ width: `${nowPct}%` }}
        />
        {cliffPct !== null && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-warning"
            style={{ left: `${cliffPct}%` }}
            title="Cliff"
          />
        )}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left: `${nowPct}%` }}
          title="Now"
        />
      </div>
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
