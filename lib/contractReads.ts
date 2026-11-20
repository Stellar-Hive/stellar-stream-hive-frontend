/**
 * Read-only contract calls (simulations) for the Stellar Stream Hive contracts.
 *
 * These functions use Soroban's simulateTransaction RPC to query contract state
 * without requiring signed transactions, so they don't need wallet access.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  Keypair,
  nativeToScVal,
  scValToNative,
  BASE_FEE,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { fetchLatestLedgerSnapshot, getSorobanServer, nativeTokenContractId, NETWORK_PASSPHRASE } from "./stellar";
import { makeTokenResolver, mapRawStream, type RawStreamRecord } from "./streamMapping";
import { withTokenMetadata } from "./tokens";
import { getStreamContractId } from "./contractIds";
import type { Stream } from "@/types";

/**
 * Builds a throwaway source account for read-only simulation calls. Soroban
 * RPC's simulateTransaction does not require the source account to exist or
 * be funded, but it does require a syntactically valid, checksummed address —
 * so we mint a fresh random keypair rather than fabricating a string.
 */
function dummySimulationAccount(): Account {
  return new Account(Keypair.random().publicKey(), "0");
}

/** Reads a stream's on-chain state without requiring a signed transaction (simulation only). */
export async function fetchStreamOnChain(streamId: string): Promise<Stream | null> {
  const contractId = getStreamContractId();
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = dummySimulationAccount();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_stream", nativeToScVal(streamId, { type: "u64" })))
    .setTimeout(30)
    .build();

  const [sim, ledgerSnapshot] = await Promise.all([
    server.simulateTransaction(tx),
    fetchLatestLedgerSnapshot().catch(() => null),
  ]);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  if (!sim.result?.retval) return null;

  const raw = scValToNative(sim.result.retval) as RawStreamRecord;
  const stream = mapRawStream(
    streamId,
    raw,
    ledgerSnapshot?.ledger,
    ledgerSnapshot ?? undefined,
    makeTokenResolver(nativeTokenContractId())
  );
  const [withToken] = await withTokenMetadata([stream]);
  return withToken;
}

/**
 * Fetches the withdrawable amount directly from the contract (not the
 * client-side estimate) — used to double-check the exact amount immediately
 * before submitting a withdraw transaction.
 */
export async function fetchWithdrawableOnChain(streamId: string): Promise<bigint> {
  const contractId = getStreamContractId();
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = dummySimulationAccount();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("withdrawable_amount", nativeToScVal(BigInt(streamId), { type: "u64" })))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    // The contract raises StreamNotFound for unknown ids; map it to the same
    // message the old pre-check (a separate get_stream simulation) used to
    // produce, instead of paying for an extra RPC round trip up front.
    if (/StreamNotFound/i.test(sim.error)) {
      throw new Error("Stream not found on-chain.");
    }
    throw new Error(sim.error);
  }
  if (!sim.result?.retval) return 0n;
  return BigInt(scValToNative(sim.result.retval) as bigint | string);
}
