/**
 * Write contract calls for the Stellar Stream Hive contracts.
 *
 * These functions build, simulate, prepare, sign (via Freighter) and submit
 * transactions that modify contract state. They are shared by every write
 * operation so error handling is consistent.
 */

import {
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  scValToNative,
  BASE_FEE,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { getSorobanServer, NETWORK_PASSPHRASE } from "./stellar";
import { signWithFreighter } from "./freighter";
import { getStreamContractId } from "./contractIds";

/**
 * Builds, simulates, prepares, signs (via Freighter) and submits a contract
 * invocation, polling for the transaction result. Shared by every write
 * operation so error handling is consistent.
 */
async function invokeContract(
  contractId: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[],
  sourcePublicKey: string
): Promise<{ hash: string; returnValue: unknown }> {
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(sourcePublicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
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
  const result = await pollTransaction(server, hash);
  return { hash, returnValue: result };
}

async function pollTransaction(
  server: SorobanRpc.Server,
  hash: string,
  timeoutMs: number = 30_000
): Promise<unknown> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await server.getTransaction(hash);
    if (response.status === "SUCCESS") {
      return response.returnValue ? scValToNative(response.returnValue) : null;
    }
    if (response.status === "FAILED") {
      throw new Error("Transaction failed on-chain. See Stellar Expert for details.");
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for transaction confirmation.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
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
}): Promise<{ streamId: string; hash: string }> {
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

  const { hash, returnValue } = await invokeContract(contractId, "create_stream", args, params.sender);
  const streamId = typeof returnValue === "bigint" ? returnValue.toString() : String(returnValue);
  return { streamId, hash };
}

/** Calls withdraw on the Stream contract for the given stream and amount (base units). */
export async function withdrawOnChain(params: {
  streamId: string;
  recipient: string;
  amount: bigint;
}): Promise<{ hash: string }> {
  const contractId = getStreamContractId();
  // Contract signature: withdraw(recipient, stream_id, amount)
  const args = [
    new Address(params.recipient).toScVal(),
    nativeToScVal(BigInt(params.streamId), { type: "u64" }),
    nativeToScVal(params.amount, { type: "i128" }),
  ];
  const { hash } = await invokeContract(contractId, "withdraw", args, params.recipient);
  return { hash };
}

/** Calls cancel_stream on the Stream contract, settling the split between sender and recipient. */
export async function cancelStreamOnChain(params: {
  streamId: string;
  sender: string;
}): Promise<{ hash: string }> {
  const contractId = getStreamContractId();
  // Contract signature: cancel_stream(sender, stream_id)
  const args = [new Address(params.sender).toScVal(), nativeToScVal(BigInt(params.streamId), { type: "u64" })];
  const { hash } = await invokeContract(contractId, "cancel_stream", args, params.sender);
  return { hash };
}
