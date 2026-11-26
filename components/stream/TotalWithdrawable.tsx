"use client";

import { useEffect, useState } from "react";
import { useLedgerSnapshot } from "@/hooks/useLedgerSnapshot";
import { computeWithdrawable, estimateCurrentLedger } from "@/lib/streaming";
import { formatTokenAmount } from "@/lib/format";
import type { Stream, TokenInfo } from "@/types";
import { TICK_MS } from "@/lib/constants";

export interface TotalWithdrawableProps {
  streams: Stream[];
}

function getWithdrawable(stream: Stream, currentLedger: number | null): bigint | null {
  if (stream.status === "cancelled") {
    return stream.frozenWithdrawableAmount === undefined ? null : BigInt(stream.frozenWithdrawableAmount);
  }
  if (stream.status === "completed") {
    const remaining = BigInt(stream.totalAmount) - BigInt(stream.withdrawnAmount);
    return remaining > 0n ? remaining : 0n;
  }
  if (stream.status === "scheduled") return 0n;
  if (currentLedger === null) return null;

  return computeWithdrawable({
    totalAmount: BigInt(stream.totalAmount),
    withdrawnAmount: BigInt(stream.withdrawnAmount),
    startLedger: stream.startLedger,
    endLedger: stream.endLedger,
    cliffLedger: stream.cliffLedger,
    currentLedger,
  });
}

/** Shows one live withdrawable total per token contract. */
export function TotalWithdrawable({ streams }: TotalWithdrawableProps) {
  const { snapshot, isLoading } = useLedgerSnapshot();
  const [, setTick] = useState(0);
  const hasLiveStreams = streams.some((stream) => stream.status === "active" || stream.status === "cliff");

  useEffect(() => {
    if (!hasLiveStreams || !snapshot) return;
    const tick = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tick);
  }, [hasLiveStreams, snapshot]);

  // Only aggregate cleanly when every stream shares a token; mixed-token
  // portfolios are shown per-card instead of summed into one misleading number.
  const firstStream = streams[0];
  if (!firstStream) return null;
  const symbol = firstStream.token.symbol;
  const decimals = firstStream.token.decimals;
  const sameToken = streams.every((s) => s.token.contractId === firstStream.token.contractId);

  const currentLedger = snapshot ? estimateCurrentLedger({
    lastKnownLedger: snapshot.ledger,
    lastKnownLedgerTimestampMs: snapshot.timestampMs,
  }) : null;

  const totals = new Map<string, { token: TokenInfo; amount: bigint | null }>();
  for (const stream of streams) {
    const { token } = stream;
    const previous = totals.get(token.contractId);
    const amount = getWithdrawable(stream, currentLedger);
    totals.set(token.contractId, {
      token: previous?.token ?? token,
      amount: amount === null || previous?.amount === null ? null : (previous?.amount ?? 0n) + amount,
    });
  }

  return (
    <div className="card px-5 py-3 text-right">
      <p className="text-xs text-muted">Total withdrawable</p>
      {[...totals.values()].map(({ token, amount }) => (
        <p key={token.contractId} className="mono-tabular text-xl font-bold text-primary">
          {amount === null ? `${token.symbol} total unavailable` : formatTokenAmount(amount, token.symbol, token.decimals, 4)}
        </p>
      ))}
    </div>
  );
}
