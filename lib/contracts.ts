/**
 * Contract call helpers for the Stellar Stream Hive Soroban contracts.
 *
 * Contract IDs are read from environment variables — they are NOT hardcoded,
 * because the contracts repo (stellar-stream-hive-contract) deploys
 * independently. Until NEXT_PUBLIC_STREAM_CONTRACT_ID /
 * NEXT_PUBLIC_VAULT_CONTRACT_ID / NEXT_PUBLIC_REGISTRY_CONTRACT_ID are set,
 * every function here throws a ContractNotConfiguredError so the UI can show
 * a clear "not yet configured" state instead of a confusing RPC failure.
 *
 * See DEPLOYMENTS.md in https://github.com/Stellar-Hive/stellar-stream-hive-contract
 * for the addresses once they exist.
 *
 * Performance (#251): the Stellar SDK is large and is loaded lazily via
 * dynamic import() so it does not land in the initial page bundles. It is
 * fetched the first time any wallet action or contract read is triggered.
 */
import type { rpc as SorobanRpcType } from "@stellar/stellar-sdk";
import { fetchLatestLedgerSnapshot, getSorobanServer, nativeTokenContractId, NETWORK_PASSPHRASE } from "./stellar";
import { signWithFreighter } from "./freighter";
import { describeFailedTransaction, isUnfundedAccountError, UNFUNDED_ACCOUNT_MESSAGE } from "./contractErrors";
import { makeTokenResolver, mapRawStream, type RawStreamRecord } from "./streamMapping";
import { withTokenMetadata } from "./tokens";
import type { Stream } from "@/types";

// Lazily imported so the Stellar SDK is not bundled on the initial page load.
// It only loads the first time a wallet action or contract read is triggered.
let _sdk: typeof import("@stellar/stellar-sdk") | null = null;
async function getSdk(): Promise<typeof import("@stellar/stellar-sdk")> {
  if (!_sdk) _sdk = await import("@stellar/stellar-sdk");
  return _sdk;
}

/**
 * Thrown when a submitted transaction was not confirmed within the polling
 * window. The transaction may still be included in a ledger afterwards, so the
 * error carries its hash: callers show it and point the user at the explorer
 * instead of inviting a blind retry that could create a second stream.
 */
export class TransactionTimeoutError extends Error {
  constructor(public readonly hash: string) {
    super(
      `Your transaction may still confirm. Check the hash on the explorer before retrying: ${hash}`
    );
    this.name = "TransactionTimeoutError";
  }
}

export class ContractNotConfiguredError extends Error {
  constructor(public readonly contractName: string) {
    super(
      `${contractName} contract ID is not configured. Set the corresponding NEXT_PUBLIC_*_CONTRACT_ID ` +
        `environment variable once the contract is deployed (see DEPLOYMENTS.md in the ` +
        `stellar-stream-hive-contract repo).`
    );
    this.name = "ContractNotConfiguredError";
  }
}

export function getStreamContractId(): string {
  const id = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Stream");
  return id;
}

export function getVaultContractId(): string {
  const id = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Vault");
  return id;
}

export function getRegistryContractId(): string {
  const id = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Registry");
  return id;
}

export function isStreamContractConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
}

/**
 * Non-throwing accessor for the Stream contract ID. Returns null when the
 * contract is not configured, so UI code can conditionally render links
 * without try/catch. Other callers should keep using getStreamContractId().
 */
export function getStreamContractIdOrNull(): string | null {
  return process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID || null;
}

export function isRegistryContractConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
}

/**
 * Builds, simulates, prepares, signs (via Freighter) and submits a contract
 * invocation, polling for the transaction result. Shared by every write
 * operation below so error handling is consistent.
 */
async function invokeContract(
  contractId: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  sourcePublicKey: string,
  signal?: AbortSignal
): Promise<{ hash: string; returnValue: unknown }> {
  const { Contract, TransactionBuilder, BASE_FEE } = await getSdk();
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(sourcePublicKey).catch((err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    if (isUnfundedAccountError(raw)) throw new Error(UNFUNDED_ACCOUNT_MESSAGE);
    throw err;
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addOperation(contract.call(method, ...(args as any[])))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);

  const signedXdr = await signWithFreighter(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: sourcePublicKey,
  });

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const hash = sendResult.hash;
  const result = await pollTransaction(server, hash, { signal });
  return { hash, returnValue: result };
}

export async function pollTransaction(
  server: SorobanRpc.Server,
  hash: string,
  timeoutMs: number = 30_000,
  pollIntervalMs: number = 1500
): Promise<unknown> {
  const start = Date.now();

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new TransactionPollAbortedError(hash);

    let response;
    try {
      response = await server.getTransaction(hash);
    } catch (err) {
      // An RPC failure is not "still pending": say so instead of retrying silently.
      const raw = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not read the status of transaction ${hash}: ${raw}`);
    }

    const status = response.status as PollStatus;
    switch (status) {
      case "SUCCESS":
        return response.returnValue ? scValToNative(response.returnValue) : null;
      case "FAILED":
        throw new Error(describeFailedTransaction(response));
      case "NOT_FOUND":
        // Not in a ledger yet: keep waiting, with a gentle backoff.
        break;
      default:
        throw new Error(`Unexpected transaction status from the RPC: ${String(status)}`);
    }

    if (Date.now() - start > timeoutMs) {
      throw new TransactionTimeoutError(hash);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Builds a throwaway source account for read-only simulation calls. Soroban
 * RPC's simulateTransaction does not require the source account to exist or
 * be funded, but it does require a syntactically valid, checksummed address —
 * so we mint a fresh random keypair rather than fabricating a string.
 */
async function dummySimulationAccount() {
  const { Account, Keypair } = await getSdk();
  return new Account(Keypair.random().publicKey(), "0");
}

/** Reads a stream's on-chain state without requiring a signed transaction (simulation only). */
export async function fetchStreamOnChain(streamId: string): Promise<Stream | null> {
  const { Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative, rpc: SorobanRpc } = await getSdk();
  const contractId = getStreamContractId();
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = await dummySimulationAccount();

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
  return withToken ?? stream;
}

/** Calls create_stream on the Stream contract. Returns the new stream's id and tx hash. */
export async function createStreamOnChain(params: {
  sender: string;
  recipient: string;
  tokenContractId: string;
  totalAmount: bigint;
  startLedger: number;
  endLedger: number;
  cliffLedger?: number;
  cancellable: boolean;
  /** Abort to stop waiting for confirmation (the transaction itself is not recalled). */
  signal?: AbortSignal;
}): Promise<{ streamId: string; hash: string }> {
  const { Address, nativeToScVal } = await getSdk();
  const contractId = getStreamContractId();

  const args = [
    new Address(params.sender).toScVal(),
    new Address(params.recipient).toScVal(),
    new Address(params.tokenContractId).toScVal(),
    nativeToScVal(params.totalAmount, { type: "i128" }),
    nativeToScVal(params.startLedger, { type: "u32" }),
    nativeToScVal(params.endLedger, { type: "u32" }),
    nativeToScVal(params.cliffLedger ?? params.startLedger, { type: "u32" }),
    nativeToScVal(params.cancellable, { type: "bool" }),
  ];

  const { hash, returnValue } = await invokeContract(
    contractId,
    "create_stream",
    args,
    params.sender,
    params.signal
  );
  const streamId = typeof returnValue === "bigint" ? returnValue.toString() : String(returnValue);
  return { streamId, hash };
}

/** Calls withdraw on the Stream contract for the given stream and amount (base units). */
export async function withdrawOnChain(params: {
  streamId: string;
  recipient: string;
  amount: bigint;
  signal?: AbortSignal;
}): Promise<{ hash: string }> {
  const { Address, nativeToScVal } = await getSdk();
  const contractId = getStreamContractId();
  // Contract signature: withdraw(recipient, stream_id, amount)
  const args = [
    new Address(params.recipient).toScVal(),
    nativeToScVal(BigInt(params.streamId), { type: "u64" }),
    nativeToScVal(params.amount, { type: "i128" }),
  ];
  const { hash } = await invokeContract(contractId, "withdraw", args, params.recipient, params.signal);
  return { hash };
}

/** Calls cancel_stream on the Stream contract, settling the split between sender and recipient. */
export async function cancelStreamOnChain(params: {
  streamId: string;
  sender: string;
  signal?: AbortSignal;
}): Promise<{ hash: string }> {
  const { Address, nativeToScVal } = await getSdk();
  const contractId = getStreamContractId();
  // Contract signature: cancel_stream(sender, stream_id)
  const args = [new Address(params.sender).toScVal(), nativeToScVal(BigInt(params.streamId), { type: "u64" })];
  const { hash } = await invokeContract(contractId, "cancel_stream", args, params.sender, params.signal);
  return { hash };
}

/**
 * Fetches the withdrawable amount directly from the contract (not the
 * client-side estimate) — used to double-check the exact amount immediately
 * before submitting a withdraw transaction.
 */
export async function fetchWithdrawableOnChain(streamId: string): Promise<bigint> {
  const { Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative, rpc: SorobanRpc } = await getSdk();
  const contractId = getStreamContractId();
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = await dummySimulationAccount();

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
