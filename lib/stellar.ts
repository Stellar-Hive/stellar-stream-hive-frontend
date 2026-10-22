/**
 * Stellar / Soroban network configuration and low-level RPC helpers shared
 * across the app: building a Soroban RPC server client, fetching the latest
 * ledger, and validating Stellar addresses.
 */
import { rpc as SorobanRpc, Networks, StrKey } from "@stellar/stellar-sdk";

export const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET") as
  | "TESTNET"
  | "PUBLIC"
  | "FUTURENET";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
  (NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET);

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

/**
 * Stellar Expert network slug for building explorer links. Stellar Expert
 * does not index Futurenet, so this is `null` in that case — callers must
 * hide explorer links rather than fabricate a wrong (testnet) one.
 */
export const STELLAR_EXPERT_NETWORK: "testnet" | "public" | null =
  NETWORK === "PUBLIC" ? "public" : NETWORK === "FUTURENET" ? null : "testnet";

let cachedServer: SorobanRpc.Server | null = null;

/** Returns a memoized Soroban RPC server client for the configured network. */
export function getSorobanServer(): SorobanRpc.Server {
  if (!cachedServer) {
    cachedServer = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: SOROBAN_RPC_URL.startsWith("http://") });
  }
  return cachedServer;
}

export interface LedgerSnapshot {
  ledger: number;
  timestampMs: number;
}

/**
 * Fetches the latest known ledger sequence from the Soroban RPC endpoint,
 * paired with the local timestamp it was observed at — used as the reference
 * point for client-side ledger estimation between re-syncs.
 */
export async function fetchLatestLedgerSnapshot(): Promise<LedgerSnapshot> {
  const server = getSorobanServer();
  const latest = await server.getLatestLedger();
  return {
    ledger: latest.sequence,
    timestampMs: Date.now(),
  };
}

/**
 * Validates a Stellar public/contract address:
 * - G-addresses (accounts) with a valid StrKey checksum
 * - C-addresses (contracts) with a valid StrKey checksum
 */
export function isValidStellarAddress(address: string, kind: "account" | "contract" | "any" = "any"): boolean {
  if (typeof address !== "string") return false;

  if (kind === "account") return StrKey.isValidEd25519PublicKey(address);
  if (kind === "contract") return StrKey.isValidContract(address);
  return StrKey.isValidEd25519PublicKey(address) || StrKey.isValidContract(address);
}

export function isValidRecipientAddress(address: string): boolean {
  return isValidStellarAddress(address, "account");
}

/** Well-known native XLM Stellar Asset Contract IDs, keyed by network. */
export const NATIVE_XLM_CONTRACT_IDS: Record<string, string> = {
  TESTNET: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  PUBLIC: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  FUTURENET: "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2C2E7UXY2L",
};

export function nativeTokenContractId(): string {
  return NATIVE_XLM_CONTRACT_IDS[NETWORK] || NATIVE_XLM_CONTRACT_IDS.TESTNET;
}
