import type { Stream } from "@/types";

export interface OutgoingTotal {
  contractId: string;
  symbol: string;
  decimals: number;
  /** Unpaid commitment across the group (total minus withdrawn), in base units. */
  amount: bigint;
}

/**
 * Sums each stream's unpaid commitment (total minus withdrawn, never below
 * zero) per token, keeping different tokens separate. Amounts stay BigInt.
 */
export function groupOutgoingByToken(streams: Stream[]): OutgoingTotal[] {
  const groups = new Map<string, OutgoingTotal>();

  for (const stream of streams) {
    const remaining = BigInt(stream.totalAmount) - BigInt(stream.withdrawnAmount);
    const amount = remaining > 0n ? remaining : 0n;
    const existing = groups.get(stream.token.contractId);

    if (existing) {
      existing.amount += amount;
    } else {
      groups.set(stream.token.contractId, {
        contractId: stream.token.contractId,
        symbol: stream.token.symbol,
        decimals: stream.token.decimals,
        amount,
      });
    }
  }

  return [...groups.values()];
}
