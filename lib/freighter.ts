/**
 * Thin wrapper around @stellar/freighter-api that normalizes error handling
 * so callers get predictable, typed results instead of having to guard
 * against Freighter's not-installed / rejected / locked states individually.
 */
import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  getNetworkDetails,
  signTransaction,
} from "@stellar/freighter-api";
import { describeContractError } from "./contractErrors";

export class FreighterNotInstalledError extends Error {
  constructor() {
    super("Freighter wallet extension is not installed.");
    this.name = "FreighterNotInstalledError";
  }
}

export class FreighterAccessDeniedError extends Error {
  constructor() {
    super("Access to Freighter was denied.");
    this.name = "FreighterAccessDeniedError";
  }
}

export class FreighterNetworkMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(`Wrong network selected in Freighter. Expected ${expected}, got ${actual}.`);
    this.name = "FreighterNetworkMismatchError";
  }
}

/** Returns true if the Freighter browser extension appears to be installed. */
export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    return !result.error;
  } catch {
    return false;
  }
}

/**
 * Requests account access from Freighter, prompting the user to connect if
 * needed, and returns the selected public key.
 */
export async function connectFreighter(): Promise<string> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new FreighterNotInstalledError();
  }

  const allowed = await isAllowed();
  if (allowed.error) {
    throw new FreighterAccessDeniedError();
  }

  if (!allowed.isAllowed) {
    const setResult = await setAllowed();
    if (setResult.error || !setResult.isAllowed) {
      throw new FreighterAccessDeniedError();
    }
  }

  const access = await requestAccess();
  if (access.error) {
    throw new FreighterAccessDeniedError();
  }

  return access.address;
}

/** Reads the currently-selected public key from Freighter without prompting for new access. */
export async function getFreighterAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    if (result.error) return null;
    return result.address || null;
  } catch {
    return null;
  }
}

/** Reads the network Freighter is currently configured for, e.g. "TESTNET". */
export async function getFreighterNetwork(): Promise<string | null> {
  try {
    const result = await getNetwork();
    if (result.error) return null;
    return result.network;
  } catch {
    return null;
  }
}

export async function getFreighterNetworkDetails() {
  try {
    const result = await getNetworkDetails();
    if (result.error) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Signs a base64 XDR transaction envelope with Freighter, scoped to the given
 * network passphrase, and returns the signed base64 XDR.
 */
export async function signWithFreighter(
  xdr: string,
  opts: { networkPassphrase: string; address: string }
): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: opts.networkPassphrase,
    address: opts.address,
  });
  if (result.error) {
    throw new Error(result.error.message || "Transaction signing was rejected.");
  }
  return result.signedTxXdr;
}

/** Human-friendly message for any error thrown by the helpers above. */
export function describeFreighterError(err: unknown): string {
  if (err instanceof FreighterNotInstalledError) {
    return "Freighter wallet extension isn't installed. Install it from freighter.app to connect.";
  }
  if (err instanceof FreighterAccessDeniedError) {
    return "Wallet access was denied. Please approve the connection request in Freighter.";
  }
  if (err instanceof FreighterNetworkMismatchError) {
    return err.message;
  }
  if (err instanceof Error) {
    if (/declined|rejected|user cancelled/i.test(err.message)) {
      return "Transaction was rejected in your wallet.";
    }
    const contractMessage = describeContractError(err.message);
    if (contractMessage) {
      return contractMessage;
    }
    return err.message;
  }
  return "An unknown wallet error occurred.";
}
