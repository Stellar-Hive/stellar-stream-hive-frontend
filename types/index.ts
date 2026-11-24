/**
 * Core domain types for Stellar Stream Hive.
 *
 * Amounts are always represented as strings holding base-unit (stroop-precision,
 * 7-decimal fixed point) integers so they can be safely round-tripped through
 * BigInt without floating point precision loss. Never store a token amount as
 * a JS `number`.
 */

export type StreamStatus = "scheduled" | "active" | "cliff" | "cancelled" | "completed";

export interface TokenInfo {
  /** Stellar contract address for the token (SAC or custom asset contract). */
  contractId: string;
  /** Ticker symbol, e.g. "XLM", "USDC". */
  symbol: string;
  /** Number of decimals the token uses (XLM/Stellar assets use 7). */
  decimals: number;
}

export interface Stream {
  id: string;
  sender: string;
  recipient: string;
  token: TokenInfo;
  /** Total amount to be streamed, in base units (stroops), as a decimal string. */
  totalAmount: string;
  /** Amount already withdrawn by the recipient, in base units, as a decimal string. */
  withdrawnAmount: string;
  /** Indexed base-unit balance still claimable after cancellation, when available. */
  frozenWithdrawableAmount?: string;
  /** Ledger sequence number at which streaming begins. */
  startLedger: number;
  /** Ledger sequence number at which streaming ends. */
  endLedger: number;
  /**
   * Optional cliff ledger — before this ledger, streamed amount is withdrawable
   * as zero even though time has elapsed. Undefined means no cliff.
   */
  cliffLedger?: number;
  /** Unix ms timestamps mirrored from ledger numbers for display convenience. */
  startTime: number;
  endTime: number;
  cliffTime?: number;
  cancellable: boolean;
  status: StreamStatus;
  /** Transaction hash of the create_stream call, for Stellar Expert linking. */
  createTxHash?: string;
}

export interface PlatformStats {
  totalStreams: number;
  totalStreamedBaseUnits: string;
  totalActiveStreams: number;
  totalValueLockedBaseUnits: string;
}

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  isFreighterInstalled: boolean;
}

export type NetworkName = "TESTNET" | "PUBLIC" | "FUTURENET";

export interface LiveBalanceState {
  /** Withdrawable amount right now, in base units, floored. */
  withdrawable: bigint;
  /** Total amount streamed so far (before subtracting withdrawn), in base units. */
  streamed: bigint;
  /** Fraction of the stream's total duration elapsed, 0..1. */
  progress: number;
  /** Whether we are still waiting on the very first on-chain fetch. */
  isLoading: boolean;
  /** Non-null if the initial fetch failed. */
  error: string | null;
  /** ms timestamp of the last successful on-chain re-sync. */
  lastSyncedAt: number | null;
}

export interface CreateStreamInput {
  recipient: string;
  tokenContractId: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: string; // human-entered decimal string, e.g. "1000.5"
  startDate: Date;
  cliffDate: Date | null;
  endDate: Date;
  cancellable: boolean;
}

export interface TxResult {
  hash: string;
  successful: boolean;
}
