/**
 * Pure mapping functions between the shapes the backends return and the
 * app-level `Stream` / `PlatformStats` types.
 *
 * There are two sources of stream data and both are snake_case:
 *
 * - the indexer API (`stellar-stream-hive-api`): `StreamView` JSON, amounts as
 *   decimal strings, status already derived from the latest ledger;
 * - the Stream contract's `get_stream`, decoded with `scValToNative`.
 *
 * Keeping this free of network and Stellar-SDK imports means it can be unit
 * tested directly (see `lib/streamMapping.test.ts`).
 */
import { ledgerToEstimatedDate } from "./streaming";
import type { PlatformStats, Stream, StreamStatus, TokenInfo } from "@/types";

/** Anchor used to translate ledger numbers into estimated wall-clock times. */
export interface LedgerReference {
  ledger: number;
  timestampMs: number;
}

/** Resolves a token contract id to display metadata. */
export type TokenResolver = (contractId: string) => TokenInfo;

/** Fallback used for any token we have no metadata for. Stellar assets use 7 decimals. */
export const defaultTokenResolver: TokenResolver = (contractId) => ({
  contractId,
  symbol: "TOKEN",
  decimals: 7,
});

/** Builds a resolver that knows about the native XLM contract and falls back otherwise. */
export function makeTokenResolver(nativeContractId: string): TokenResolver {
  return (contractId) =>
    contractId === nativeContractId ? { contractId, symbol: "XLM", decimals: 7 } : defaultTokenResolver(contractId);
}

// ---------------------------------------------------------------------------
// Indexer API
// ---------------------------------------------------------------------------

/** `StreamView` as serialized by `GET /streams`, `/senders/:a`, `/recipients/:a`. */
export interface ApiStreamView {
  id: string;
  sender: string;
  recipient: string;
  token: string;
  total_amount: string;
  withdrawn: string;
  start_ledger: number;
  end_ledger: number;
  cliff_ledger: number;
  cancellable: boolean;
  status: "pending" | "active" | "completed" | "cancelled";
  created_at: number;
  streamed_amount: string;
  withdrawable_amount: string;
  progress_percent: number;
}

/** `GET /stats`. */
export interface ApiStats {
  total_streams: number;
  active_streams: number;
  total_streamed: string;
  total_withdrawn: string;
  /** Present on API versions that report it; derived as 0 when absent. */
  total_value_locked?: string;
}

/** `GET /ready`. */
export interface ApiReadiness {
  synced: boolean;
  latest_ledger: number;
  contract_configured: boolean;
  indexed_streams: number;
}

/**
 * Maps the API's status onto the UI's richer status set. The API has no
 * "cliff" state, so an active stream still before its cliff ledger is shown as
 * "cliff" (accruing, but nothing withdrawable yet).
 */
export function mapApiStatus(
  view: Pick<ApiStreamView, "status" | "start_ledger" | "cliff_ledger">,
  currentLedger?: number
): StreamStatus {
  switch (view.status) {
    case "pending":
      return "scheduled";
    case "cancelled":
      return "cancelled";
    case "completed":
      return "completed";
    case "active":
      return currentLedger !== undefined && view.cliff_ledger > view.start_ledger && currentLedger < view.cliff_ledger
        ? "cliff"
        : "active";
  }
}

/**
 * Guards against a missing or renamed field in a `StreamView` JSON item
 * before it reaches `mapApiStream`, where a `undefined` would otherwise
 * throw deep inside a render (reading `.toString()` off `undefined`) or
 * silently surface as `NaN`.
 */
export function isValidApiStream(value: unknown): value is ApiStreamView {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.sender === "string" &&
    typeof v.recipient === "string" &&
    typeof v.token === "string" &&
    typeof v.total_amount === "string" &&
    typeof v.withdrawn === "string" &&
    typeof v.start_ledger === "number" &&
    typeof v.end_ledger === "number" &&
    typeof v.cliff_ledger === "number" &&
    typeof v.cancellable === "boolean" &&
    (v.status === "pending" || v.status === "active" || v.status === "completed" || v.status === "cancelled") &&
    typeof v.created_at === "number"
  );
}

/** Same purpose as {@link isValidApiStream}, for the single `/stats` payload. */
export function isValidApiStats(value: unknown): value is ApiStats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.total_streams === "number" &&
    typeof v.active_streams === "number" &&
    typeof v.total_streamed === "string" &&
    typeof v.total_withdrawn === "string" &&
    (v.total_value_locked === undefined || typeof v.total_value_locked === "string")
  );
}

export function mapApiStream(
  view: ApiStreamView,
  reference: LedgerReference | null,
  resolveToken: TokenResolver = defaultTokenResolver
): Stream {
  // Wall-clock times are only estimates derived from one ledger/time anchor.
  const toTime = (ledger: number) => (reference ? ledgerToEstimatedDate(ledger, reference).getTime() : 0);
  const hasCliff = view.cliff_ledger > view.start_ledger;

  return {
    id: view.id,
    sender: view.sender,
    recipient: view.recipient,
    token: resolveToken(view.token),
    totalAmount: view.total_amount,
    withdrawnAmount: view.withdrawn,
    ...(view.status === "cancelled" && { frozenWithdrawableAmount: view.withdrawable_amount }),
    startLedger: view.start_ledger,
    endLedger: view.end_ledger,
    cliffLedger: hasCliff ? view.cliff_ledger : undefined,
    startTime: toTime(view.start_ledger),
    endTime: toTime(view.end_ledger),
    cliffTime: hasCliff ? toTime(view.cliff_ledger) : undefined,
    cancellable: view.cancellable,
    status: mapApiStatus(view, reference?.ledger),
  };
}

export function mapApiStats(stats: ApiStats): PlatformStats {
  return {
    totalStreams: stats.total_streams,
    totalStreamedBaseUnits: stats.total_streamed,
    totalActiveStreams: stats.active_streams,
    totalValueLockedBaseUnits: stats.total_value_locked ?? "0",
  };
}

// ---------------------------------------------------------------------------
// On-chain `get_stream`
// ---------------------------------------------------------------------------

/**
 * `Stream` as returned by the contract's `get_stream` after `scValToNative`.
 * Field names match `contracts/stream/src/types.rs` exactly.
 */
export interface RawStreamRecord {
  sender: string;
  recipient: string;
  token: string;
  total_amount: bigint | string;
  withdrawn: bigint | string;
  start_ledger: number;
  end_ledger: number;
  cliff_ledger: number;
  cancellable: boolean;
  /**
   * `StreamStatus` is a unit-variant enum; `scValToNative` yields `["Cancelled"]`
   * (a one-element array), while other decoders yield the bare string.
   */
  status: string | string[];
}

function variantName(status: string | string[]): string {
  return Array.isArray(status) ? String(status[0] ?? "") : status;
}

export function deriveOnChainStatus(raw: RawStreamRecord, currentLedger?: number): StreamStatus {
  const status = variantName(raw.status);
  if (status === "Cancelled") return "cancelled";
  if (status === "Completed") return "completed";
  if (currentLedger === undefined) return "active";
  if (currentLedger < raw.start_ledger) return "scheduled";
  if (currentLedger >= raw.end_ledger) return "completed";
  if (raw.cliff_ledger > raw.start_ledger && currentLedger < raw.cliff_ledger) return "cliff";
  return "active";
}

export function mapRawStream(
  id: string,
  raw: RawStreamRecord,
  currentLedger?: number,
  reference?: LedgerReference,
  resolveToken: TokenResolver = defaultTokenResolver
): Stream {
  const toTime = (ledger: number) => (reference ? ledgerToEstimatedDate(ledger, reference).getTime() : 0);
  const hasCliff = raw.cliff_ledger > raw.start_ledger;

  return {
    id,
    sender: raw.sender,
    recipient: raw.recipient,
    token: resolveToken(raw.token),
    totalAmount: BigInt(raw.total_amount).toString(),
    withdrawnAmount: BigInt(raw.withdrawn).toString(),
    startLedger: raw.start_ledger,
    endLedger: raw.end_ledger,
    cliffLedger: hasCliff ? raw.cliff_ledger : undefined,
    startTime: toTime(raw.start_ledger),
    endTime: toTime(raw.end_ledger),
    cliffTime: hasCliff ? toTime(raw.cliff_ledger) : undefined,
    cancellable: raw.cancellable,
    status: deriveOnChainStatus(raw, currentLedger),
  };
}
