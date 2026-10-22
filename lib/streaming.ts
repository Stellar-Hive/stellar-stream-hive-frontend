/**
 * Client-side mirror of the on-chain streaming math.
 *
 * This MUST mirror the Soroban contract's i128 fixed-point arithmetic exactly:
 * multiply before dividing, use BigInt (never JS `number`) for amounts, and
 * always floor (round toward zero / down) — never round up. Displaying a
 * balance the recipient can't actually withdraw would be a bug, since the
 * contract itself floors on division.
 */

export const AVERAGE_LEDGER_SECONDS = 5;

export interface StreamedAmountParams {
  totalAmount: bigint;
  startLedger: number;
  endLedger: number;
  currentLedger: number;
}

/**
 * Computes the total amount streamed as of `currentLedger`, using the same
 * formula as the contract:
 *
 *   elapsed        = min(currentLedger, endLedger) - startLedger
 *   totalDuration  = endLedger - startLedger
 *   streamed       = floor(totalAmount * elapsed / totalDuration)
 *
 * Clamped so the result is never negative and never exceeds totalAmount.
 */
export function computeStreamedAmount({
  totalAmount,
  startLedger,
  endLedger,
  currentLedger,
}: StreamedAmountParams): bigint {
  if (endLedger <= startLedger) return totalAmount;
  if (currentLedger <= startLedger) return 0n;

  const clampedCurrent = Math.min(currentLedger, endLedger);
  const elapsed = BigInt(clampedCurrent - startLedger);
  const totalDuration = BigInt(endLedger - startLedger);

  // Multiply before divide, exactly as i128 contract arithmetic would.
  const streamed = (totalAmount * elapsed) / totalDuration;

  if (streamed > totalAmount) return totalAmount;
  if (streamed < 0n) return 0n;
  return streamed;
}

export interface WithdrawableParams extends StreamedAmountParams {
  withdrawnAmount: bigint;
  /** If set, no amount is withdrawable before this ledger, even if time has elapsed. */
  cliffLedger?: number;
}

/**
 * Computes the amount currently withdrawable: streamed-to-date minus what has
 * already been withdrawn, respecting an optional cliff.
 */
export function computeWithdrawable(params: WithdrawableParams): bigint {
  const { cliffLedger, currentLedger, withdrawnAmount } = params;

  if (cliffLedger !== undefined && currentLedger < cliffLedger) {
    return 0n;
  }

  const streamed = computeStreamedAmount(params);
  const withdrawable = streamed - withdrawnAmount;
  return withdrawable > 0n ? withdrawable : 0n;
}

export interface CancelSplitParams {
  totalAmount: bigint;
  /** Amount streamed to date, as computed by `computeStreamedAmount`. */
  streamedAmount: bigint;
  /** If set, nothing is paid to the recipient before this ledger. */
  cliffLedger?: number;
  currentLedger: number;
}

export interface CancelSplit {
  recipientGets: bigint;
  senderGets: bigint;
}

/**
 * Computes how a cancelled stream's remaining balance is split, mirroring the
 * contract: cancelling before the cliff refunds the sender in full and pays
 * the recipient nothing; otherwise the recipient keeps what has streamed and
 * the sender gets the rest. All amounts stay BigInt and are clamped to
 * non-negative values.
 */
export function computeCancelSplit({
  totalAmount,
  streamedAmount,
  cliffLedger,
  currentLedger,
}: CancelSplitParams): CancelSplit {
  if (cliffLedger !== undefined && currentLedger < cliffLedger) {
    return { recipientGets: 0n, senderGets: totalAmount > 0n ? totalAmount : 0n };
  }

  const recipientGets =
    streamedAmount > 0n
      ? streamedAmount > totalAmount
        ? totalAmount
        : streamedAmount
      : 0n;
  const senderGets = totalAmount - recipientGets;

  return {
    recipientGets,
    senderGets: senderGets > 0n ? senderGets : 0n,
  };
}

/**
 * Progress fraction (0..1) through the stream's total duration, for progress
 * bars / timelines. Not clamped to the cliff — this reflects raw time elapsed.
 */
export function computeProgress(params: {
  startLedger: number;
  endLedger: number;
  currentLedger: number;
}): number {
  const { startLedger, endLedger, currentLedger } = params;
  if (endLedger <= startLedger) return 1;
  if (currentLedger <= startLedger) return 0;
  if (currentLedger >= endLedger) return 1;
  return (currentLedger - startLedger) / (endLedger - startLedger);
}

/**
 * Estimates the current ledger sequence number given a known ledger at a
 * known point in time, extrapolating forward using Stellar's ~5s average
 * ledger close time. This is only ever used for the smooth per-second UI
 * tick; the real value is re-synced from chain periodically.
 */
export function estimateCurrentLedger(params: {
  lastKnownLedger: number;
  lastKnownLedgerTimestampMs: number;
  nowMs?: number;
}): number {
  const nowMs = params.nowMs ?? Date.now();
  const secondsSinceSync = Math.max(0, (nowMs - params.lastKnownLedgerTimestampMs) / 1000);
  const ledgersElapsed = Math.floor(secondsSinceSync / AVERAGE_LEDGER_SECONDS);
  return params.lastKnownLedger + ledgersElapsed;
}

/**
 * Converts a wall-clock Date into an estimated ledger number, given a
 * reference (current) ledger/time pair. Used by the create-stream form to
 * translate human-picked start/cliff/end dates into ledger numbers.
 */
export function dateToEstimatedLedger(
  date: Date,
  reference: { ledger: number; timestampMs: number }
): number {
  const deltaSeconds = (date.getTime() - reference.timestampMs) / 1000;
  const deltaLedgers = Math.round(deltaSeconds / AVERAGE_LEDGER_SECONDS);
  return reference.ledger + deltaLedgers;
}

/** Converts a ledger number back into an estimated wall-clock Date. */
export function ledgerToEstimatedDate(
  ledger: number,
  reference: { ledger: number; timestampMs: number }
): Date {
  const deltaLedgers = ledger - reference.ledger;
  const deltaMs = deltaLedgers * AVERAGE_LEDGER_SECONDS * 1000;
  return new Date(reference.timestampMs + deltaMs);
}

/** Rate of streaming per ledger, expressed as a bigint numerator (amount) / denominator (ledgers). */
export function computeRatePerSecond(totalAmount: bigint, startLedger: number, endLedger: number): number {
  const totalDuration = endLedger - startLedger;
  if (totalDuration <= 0) return 0;
  const totalSeconds = totalDuration * AVERAGE_LEDGER_SECONDS;
  // This is only used for human-readable rate display, so a float division
  // of already-decimal-converted amounts is acceptable here (not for balances).
  return Number(totalAmount) / totalSeconds;
}
