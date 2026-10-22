"use client";

import { useEffect, useState } from "react";
import type { LedgerSnapshot } from "@/lib/stellar";
import { computeProgress, computeWithdrawable, computeStreamedAmount, estimateCurrentLedger } from "@/lib/streaming";
import type { LiveBalanceState } from "@/types";
import { TICK_MS } from "@/lib/constants";
import { useLedgerSnapshot } from "@/hooks/useLedgerSnapshot";

export interface UseLiveBalanceParams {
  totalAmount: bigint;
  withdrawnAmount: bigint;
  startLedger: number;
  endLedger: number;
  cliffLedger?: number;
  /**
   * Supplies a fixed ledger/time reference instead of fetching one from
   * chain, and skips periodic re-sync. Used for the landing page's
   * no-wallet-required demo simulation — never for a real stream.
   */
  simulatedReference?: LedgerSnapshot;
  /** Set false to freeze the ticker (e.g. cancelled/completed streams). */
  enabled?: boolean;
}

/**
 * Drives the signature "live balance" experience: ticks the withdrawable
 * amount upward once per second by estimating the current ledger from the
 * last known chain snapshot, then re-syncs with chain every 30s to correct
 * for drift between Stellar's actual (variable) ledger close times and our
 * ~5s estimate.
 *
 * All amount math is BigInt and floors — this hook will never report a
 * withdrawable amount larger than the contract would actually allow.
 */
export function useLiveBalance(params: UseLiveBalanceParams): LiveBalanceState {
  const { totalAmount, withdrawnAmount, startLedger, endLedger, cliffLedger, simulatedReference, enabled = true } =
    params;

  const [, setTick] = useState(0);

  // Shared ledger snapshot: one fetch + 30s re-sync per page, regardless of
  // how many components consume it. In simulated mode the fixed reference is
  // used and no chain fetch happens. When `enabled` is false we still want the
  // initial snapshot so completed/cancelled streams report their real
  // remaining balance instead of a placeholder zero.
  const { snapshot, isLoading, error, lastSyncedAt } = useLedgerSnapshot({ simulatedReference });

  // Per-second UI tick. Purely forces a re-render so the derived values below
  // recompute against the current wall-clock time.
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!snapshot) {
    return {
      withdrawable: 0n,
      streamed: 0n,
      progress: 0,
      isLoading: isLoading || !error,
      error,
      lastSyncedAt,
    };
  }

  const currentLedger = enabled
    ? estimateCurrentLedger({ lastKnownLedger: snapshot.ledger, lastKnownLedgerTimestampMs: snapshot.timestampMs })
    : snapshot.ledger;

  const streamed = computeStreamedAmount({ totalAmount, startLedger, endLedger, currentLedger });
  const withdrawable = computeWithdrawable({
    totalAmount,
    withdrawnAmount,
    startLedger,
    endLedger,
    currentLedger,
    cliffLedger,
  });
  const progress = computeProgress({ startLedger, endLedger, currentLedger });

  return {
    withdrawable,
    streamed,
    progress,
    isLoading,
    error,
    lastSyncedAt,
  };
}
