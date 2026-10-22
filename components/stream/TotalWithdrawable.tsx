"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLatestLedgerSnapshot, type LedgerSnapshot } from "@/lib/stellar";
import { computeWithdrawable, estimateCurrentLedger } from "@/lib/streaming";
import { formatTokenAmount } from "@/lib/format";
import type { Stream } from "@/types";
import { RESYNC_MS, TICK_MS } from "@/lib/constants";

export interface TotalWithdrawableProps {
  streams: Stream[];
}

/**
 * Aggregates the live withdrawable balance across multiple streams that
 * share the same token, ticking once per second off a single shared ledger
 * reference (rather than one RPC poll per card).
 */
export function TotalWithdrawable({ streams }: TotalWithdrawableProps) {
  const [reference, setReference] = useState<LedgerSnapshot | null>(null);
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    function sync() {
      fetchLatestLedgerSnapshot()
        .then((snap) => {
          if (mountedRef.current) setReference(snap);
        })
        .catch(() => undefined);
    }
    sync();
    const resync = setInterval(sync, RESYNC_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(resync);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  if (streams.length === 0 || !reference) return null;

  // Only aggregate cleanly when every stream shares a token; mixed-token
  // portfolios are shown per-card instead of summed into one misleading number.
  const symbol = streams[0].token.symbol;
  const decimals = streams[0].token.decimals;
  const sameToken = streams.every((s) => s.token.contractId === streams[0].token.contractId);

  if (!sameToken) return null;

  const currentLedger = estimateCurrentLedger({
    lastKnownLedger: reference.ledger,
    lastKnownLedgerTimestampMs: reference.timestampMs,
  });

  const total = streams.reduce((sum, s) => {
    if (s.status === "active" || s.status === "cliff") {
      return (
        sum +
        computeWithdrawable({
          totalAmount: BigInt(s.totalAmount),
          withdrawnAmount: BigInt(s.withdrawnAmount),
          startLedger: s.startLedger,
          endLedger: s.endLedger,
          cliffLedger: s.cliffLedger,
          currentLedger,
        })
      );
    }
    // Completed streams (fully vested) and cancelled streams (the frozen
    // share settled at cancellation) no longer accrue live, so their
    // withdrawable amount is simply whatever hasn't been withdrawn yet —
    // no ledger-based calculation needed.
    if (s.status === "completed" || s.status === "cancelled") {
      return sum + (BigInt(s.totalAmount) - BigInt(s.withdrawnAmount));
    }
    return sum;
  }, 0n);

  return (
    <div className="card px-5 py-3 text-right">
      <p className="text-xs text-muted">Total withdrawable</p>
      <p className="mono-tabular text-xl font-bold text-primary">{formatTokenAmount(total, symbol, decimals, 4)}</p>
    </div>
  );
}
