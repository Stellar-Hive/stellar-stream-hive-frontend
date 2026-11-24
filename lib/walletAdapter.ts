/**
 * Wallet adapter abstraction for integrating multiple Stellar wallets.
 * Each wallet implementation adapts to this interface, allowing the app
 * to remain wallet-agnostic while supporting multiple signing providers.
 */
import {
  FREIGHTER_NOT_INSTALLED_DESC,
  FREIGHTER_ACCESS_DENIED_DESC,
  FREIGHTER_TX_REJECTED_DESC,
  WALLET_UNKNOWN_ERROR_DESC,
} from "@/lib/messages";

export interface WalletAdapter {
  /** Display name for the wallet (e.g., "Freighter", "Stellar Lab") */
  readonly name: string;

  /** Check if this wallet is installed in the user's browser */
  isInstalled(): Promise<boolean>;

  /** Request access and return the user's public key */
  connect(): Promise<string>;

  /** Get the currently-connected public key without prompting */
  getAddress(): Promise<string | null>;

  /** Get the network the wallet is configured for (e.g., "TESTNET", "PUBLIC") */
  getNetwork(): Promise<string | null>;

  /** Sign a transaction XDR and return the signed XDR */
  signTransaction(xdr: string, networkPassphrase: string, address: string): Promise<string>;

  /** Subscribe to account changes. Returns an unsubscribe function. */
  watchAccount?(callback: (address: string) => void): () => void;

  /** Subscribe to network changes. Returns an unsubscribe function. */
  watchNetwork?(callback: (network: string) => void): () => void;

  /** Disconnect the wallet (if applicable) */
  disconnect?(): Promise<void>;

  /** Get human-readable error message for errors thrown by this adapter */
  describeError(error: unknown): string;
}

export class WalletNotInstalledError extends Error {
  constructor(walletName: string) {
    super(`${walletName} wallet is not installed.`);
    this.name = "WalletNotInstalledError";
  }
}

export class WalletAccessDeniedError extends Error {
  constructor(walletName: string) {
    super(`Access to ${walletName} was denied.`);
    this.name = "WalletAccessDeniedError";
  }
}

export class WalletNetworkMismatchError extends Error {
  constructor(walletName: string, expected: string, actual: string) {
    super(`${walletName}: Expected ${expected}, got ${actual}.`);
    this.name = "WalletNetworkMismatchError";
  }
}

/** Available wallet adapters. Order matters: listed first are tried first on connect. */
export const WALLET_ADAPTERS: Record<string, () => WalletAdapter> = {
  freighter: () => createFreighterAdapter(),
  // Future: add more wallet adapters here
  // stellarlab: () => createStellarLabAdapter(),
  // albedo: () => createAlbedoAdapter(),
};

/** Create a Freighter wallet adapter */
function createFreighterAdapter(): WalletAdapter {
  return {
    name: "Freighter",
    async isInstalled() {
      try {
        const freighter = getFreighterApi();
        return freighter ? true : false;
      } catch {
        return false;
      }
    },
    async connect() {
      const freighter = getFreighterApi();
      if (!freighter) throw new WalletNotInstalledError("Freighter");

      const address = await freighter.requestAccess();
      if (!address) throw new WalletAccessDeniedError("Freighter");
      return typeof address === "string" ? address : address.address || "";
    },
    async getAddress() {
      try {
        const freighter = getFreighterApi();
        const address = await freighter?.getPublicKey?.();
        return address || null;
      } catch {
        return null;
      }
    },
    async getNetwork() {
      try {
        const freighter = getFreighterApi();
        return (await freighter?.getNetwork?.()) || null;
      } catch {
        return null;
      }
    },
    async signTransaction(xdr, networkPassphrase, address) {
      const freighter = getFreighterApi();
      if (!freighter) throw new WalletNotInstalledError("Freighter");

      const result = await freighter.signTransaction(xdr, { networkPassphrase, address });
      if (typeof result === "object" && "error" in result && result.error) {
        throw new Error(result.error.message || "Signing failed");
      }
      return result;
    },
    watchAccount(callback) {
      const freighter = getFreighterApi();
      return freighter?.watchAccount?.(callback) ?? (() => {});
    },
    watchNetwork(callback) {
      const freighter = getFreighterApi();
      return freighter?.watchNetwork?.(callback) ?? (() => {});
    },
    describeError(error) {
      if (error instanceof WalletNotInstalledError) {
        return FREIGHTER_NOT_INSTALLED_DESC;
      }
      if (error instanceof WalletAccessDeniedError) {
        return FREIGHTER_ACCESS_DENIED_DESC;
      }
      if (error instanceof WalletNetworkMismatchError) {
        return error.message;
      }
      if (error instanceof Error) {
        if (/declined|rejected|user cancelled/i.test(error.message)) {
          return FREIGHTER_TX_REJECTED_DESC;
        }
        return error.message;
      }
      return WALLET_UNKNOWN_ERROR_DESC;
    },
  };
}

/** Get the Freighter API from the window object */
function getFreighterApi() {
  if (typeof window === "undefined") return null;
  return (window as any).freighter || null;
}

/**
 * Example of how to add another wallet adapter (e.g., Stellar Lab):
 *
 * function createStellarLabAdapter(): WalletAdapter {
 *   return {
 *     name: "Stellar Lab",
 *     async isInstalled() { ... },
 *     async connect() { ... },
 *     async getAddress() { ... },
 *     async getNetwork() { ... },
 *     async signTransaction(xdr, networkPassphrase, address) { ... },
 *     watchAccount(callback) { ... },
 *     watchNetwork(callback) { ... },
 *     describeError(error) { ... },
 *   };
 * }
 *
 * To integrate @creit.tech/stellar-wallets-kit:
 * 1. Install: npm install @creit.tech/stellar-wallets-kit
 * 2. Create adapters for each supported wallet in stellar-wallets-kit
 * 3. Add them to WALLET_ADAPTERS
 * 4. Update ConnectButton to show all available wallets
 *
 * The app remains wallet-agnostic; only adapters change per wallet.
 */
