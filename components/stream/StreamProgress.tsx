"use client";

import { useLedgerSnapshot } from "@/hooks/useLedgerSnapshot";
import { useLiveBalance } from "@/hooks/useLiveBalance";
import { formatTokenAmount } from "@/lib/format";
import type { LedgerSnapshot } from "@/lib/stellar";

export interface StreamProgressProps {
  totalAmount: string;
  withdrawnAmount: string;
  startLedger: number;
  endLedger: number;
  cliffLedger?: number;
  tokenSymbol: string;
  tokenDecimals?: number;
  simulatedReference?: LedgerSnapshot;
  enabled?: boolean;
}

/** Shows % streamed, amount already withdrawn, and amount remaining in the stream. */
export function StreamProgress({
  totalAmount,
  withdrawnAmount,
  startLedger,
  endLedger,
  cliffLedger,
  tokenSymbol,
  tokenDecimals = 7,
  simulatedReference,
  enabled = true,
}: StreamProgressProps) {
  const total = BigInt(totalAmount);
  const withdrawn = BigInt(withdrawnAmount);

  // Share a single ledger snapshot across the stream detail page instead of
  // letting each component poll `getLatestLedger` on its own.
  const { reference, status } = useLedgerSnapshot({ simulatedReference, enabled });

  const state = useLiveBalance({
    totalAmount: total,
    withdrawnAmount: withdrawn,
    startLedger,
    endLedger,
    cliffLedger,
    reference,
    enabled,
  });

  if (!reference) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">Progress</span>
          <span className="mono-tabular font-medium">—</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-label="Stream progress"
          aria-busy={status === "loading"}
          className="h-2 w-full overflow-hidden rounded-full bg-border"
        />
        <div className="mt-4 text-sm text-muted">
          {status === "error" ? "Unable to load ledger data." : "Loading stream progress…"}
        </div>
      </div>
    );
  }

  const remaining = total - state.streamed;
  const percent = Math.min(100, Math.max(0, state.progress * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted">Progress</span>
        <span className="mono-tabular font-medium">{percent.toFixed(1)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Stream progress"
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-dark to-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <Stat label="Streamed" value={formatTokenAmount(state.streamed, tokenSymbol, tokenDecimals, 4)} />
        <Stat label="Withdrawn" value={formatTokenAmount(withdrawn, tokenSymbol, tokenDecimals, 4)} />
        <Stat label="Remaining" value={formatTokenAmount(remaining, tokenSymbol, tokenDecimals, 4)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mono-tabular mt-0.5 font-medium">{value}</div>
    </div>
  );
}
