"use client";

import { formatDistanceToNow } from "date-fns";
import { useId } from "react";
import { useLiveBalance } from "@/hooks/useLiveBalance";
import { formatBaseUnits } from "@/lib/format";
import type { LedgerSnapshot } from "@/lib/stellar";
import { Spinner } from "@/components/ui/Spinner";

export interface LiveBalanceProps {
  totalAmount: string;
  withdrawnAmount: string;
  startLedger: number;
  endLedger: number;
  cliffLedger?: number;
  tokenSymbol: string;
  tokenDecimals?: number;
  /** Fixed reference point for a pure client-side demo — never used for real streams. */
  simulatedReference?: LedgerSnapshot;
  /** Freeze the ticker, e.g. for a cancelled or completed stream. */
  enabled?: boolean;
  size?: "sm" | "lg";
  label?: string;
}

/**
 * The signature "live balance" counter: the recipient's withdrawable amount
 * ticking upward once per second, computed entirely client-side with BigInt
 * so it never overstates what the contract would actually let them withdraw.
 */
export function LiveBalance({
  totalAmount,
  withdrawnAmount,
  startLedger,
  endLedger,
  cliffLedger,
  tokenSymbol,
  tokenDecimals = 7,
  simulatedReference,
  enabled = true,
  size = "lg",
  label = "Withdrawable now",
}: LiveBalanceProps) {
  const labelId = useId();
  const state = useLiveBalance({
    totalAmount: BigInt(totalAmount),
    withdrawnAmount: BigInt(withdrawnAmount),
    startLedger,
    endLedger,
    cliffLedger,
    simulatedReference,
    enabled,
  });

  const isDemo = !!simulatedReference;

  if (state.isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted">
        <Spinner size={size === "lg" ? "md" : "sm"} />
        <span className="text-sm">Loading live balance…</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        Couldn&apos;t sync with the Stellar network: {state.error}
      </div>
    );
  }

  const formatted = formatBaseUnits(state.withdrawable, tokenDecimals, {
    maxDecimals: 7,
    minDecimals: 7,
    grouped: true,
  });

  return (
    <div role="group" aria-labelledby={labelId}>
      <div id={labelId} className="mb-1.5 flex items-center gap-2 text-sm text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        {label}
        {isDemo && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Demo
          </span>
        )}
      </div>
      <div
        aria-live="off"
        className={`mono-tabular font-bold leading-tight ${size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl"}`}
      >
        {formatted} <span className="text-muted">{tokenSymbol}</span>
      </div>
      {!isDemo && state.lastSyncedAt && (
        <p className="mt-2 text-xs text-muted">
          Synced with chain {formatDistanceToNow(state.lastSyncedAt, { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
