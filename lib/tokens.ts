/**
 * Reads token symbol/decimals from the token contract (SEP-41 `symbol()` and
 * `decimals()`), via simulation only -- no signing, no fees. All of the caching
 * and sanitising logic lives in `tokenMetadata.ts`; this file is just the
 * Soroban RPC glue plus a shared per-session cache.
 */
import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc as SorobanRpc, scValToNative } from "@stellar/stellar-sdk";
import { getSorobanServer, nativeTokenContractId, NETWORK_PASSPHRASE } from "./stellar";
import { createTokenMetadataCache, enrichStreamTokens, type RawTokenMetadata } from "./tokenMetadata";
import type { Stream, TokenInfo } from "@/types";

/** Per-token outgoing commitment: `totalAmount - withdrawnAmount`, summed as BigInt. */
export interface OutgoingTokenTotal {
  contractId: string;
  symbol: string;
  decimals: number;
  /** Sum of `totalAmount - withdrawnAmount` over the live streams for this token. */
  amount: bigint;
}

export interface OutgoingSummary {
  /** One entry per distinct token contract id, in first-seen order. */
  totals: OutgoingTokenTotal[];
  /** True when every live stream uses the same token (or there are none). */
  singleToken: boolean;
}

/**
 * Groups live streams by token contract id and sums their outstanding amount
 * (`totalAmount - withdrawnAmount`) as BigInt. Streams whose token metadata is
 * unknown are skipped rather than guessed at.
 */
export function summarizeOutgoingByToken(
  streams: Stream[],
  getInfo: (contractId: string) => TokenInfo,
): OutgoingSummary {
  const byToken = new Map<string, OutgoingTokenTotal>();

  for (const stream of streams) {
    if (!stream.isActive) continue;
    const info = getInfo(stream.tokenContractId);
    if (!info) continue;

    const outstanding = stream.totalAmount - stream.withdrawnAmount;
    const existing = byToken.get(stream.tokenContractId);
    if (existing) {
      existing.amount += outstanding;
    } else {
      byToken.set(stream.tokenContractId, {
        contractId: stream.tokenContractId,
        symbol: info.symbol,
        decimals: info.decimals,
        amount: outstanding,
      });
    }
  }

  const totals = [...byToken.values()];
  return { totals, singleToken: totals.length <= 1 };
}

async function simulateRead(contractId: string, method: "symbol" | "decimals"): Promise<unknown> {
  // Simulation needs a source account but never submits, so a throwaway keypair is fine.
  const account = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(30)
    .build();

  const sim = await getSorobanServer().simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim.result?.retval === undefined ? undefined : scValToNative(sim.result.retval);
}

async function readTokenMetadata(contractId: string): Promise<RawTokenMetadata> {
  const [symbol, decimals] = await Promise.all([
    simulateRead(contractId, "symbol"),
    simulateRead(contractId, "decimals"),
  ]);
  return { symbol, decimals };
}

const NATIVE: TokenInfo = { contractId: nativeTokenContractId(), symbol: "XLM", decimals: 7 };

const cache = createTokenMetadataCache(readTokenMetadata, { [NATIVE.contractId]: NATIVE });

/** Display info for a token; never rejects (falls back to `TOKEN`/7 when unreadable). */
export const getTokenInfo = cache.get;

/** Like `getTokenInfo`, but reports whether the values were actually read from the contract. */
export const lookupTokenInfo = cache.lookup;

/** Fills in real symbol/decimals on a list of streams (one lookup per distinct token). */
export function withTokenMetadata(streams: Stream[]): Promise<Stream[]> {
  return enrichStreamTokens(streams, getTokenInfo);
}
