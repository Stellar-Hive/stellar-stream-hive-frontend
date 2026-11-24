/**
 * Centralised user-facing strings for wallet interactions and error states.
 *
 * Keeping these in one place makes wording changes easy and lays the
 * groundwork for future translations without introducing an i18n library now.
 *
 * Scope: wallet connection messages and generic error messages used across
 * components. Contract-specific error codes live in lib/contractErrors.ts
 * (they map numeric codes to sentences and are a different concern).
 */

// ---------------------------------------------------------------------------
// Wallet — detection
// ---------------------------------------------------------------------------

export const WALLET_DETECTING = "Checking wallet…";
export const WALLET_DETECTING_ARIA_LABEL = "Detecting Freighter wallet";

// ---------------------------------------------------------------------------
// Wallet — not installed
// ---------------------------------------------------------------------------

export const WALLET_NOT_INSTALLED_LINK_TEXT = "Install Freighter";
export const WALLET_NOT_INSTALLED_TITLE = "Freighter wallet extension is required";
export const WALLET_NOT_INSTALLED_ERROR = "Freighter wallet is not installed.";

// ---------------------------------------------------------------------------
// Wallet — connecting
// ---------------------------------------------------------------------------

export const WALLET_CONNECTING = "Connecting…";
export const WALLET_CONNECT_BUTTON = "Connect Wallet";

/** Shown when requestAccess returns without an address. */
export const WALLET_NO_ADDRESS_ERROR = "Unable to retrieve wallet address.";

/** Generic fallback when connect() throws an unknown error. */
export const WALLET_CONNECT_FAILED_ERROR = "Failed to connect wallet.";

// ---------------------------------------------------------------------------
// Wallet — connected / menu
// ---------------------------------------------------------------------------

export const WALLET_DISCONNECT_LABEL = "Disconnect";
export const WALLET_UNKNOWN_NETWORK = "Unknown network";

// ---------------------------------------------------------------------------
// Wallet — adapter-level descriptions
// ---------------------------------------------------------------------------

/** Shown when Freighter is not installed and the user tries to act. */
export const FREIGHTER_NOT_INSTALLED_DESC =
  "Freighter wallet isn't installed. Install it from freighter.app to connect.";

/** Shown when the user denies the connection request. */
export const FREIGHTER_ACCESS_DENIED_DESC =
  "Wallet access was denied. Please approve the connection request in Freighter.";

/** Shown when the user rejects a transaction. */
export const FREIGHTER_TX_REJECTED_DESC = "Transaction was rejected in your wallet.";

/** Generic fallback for unknown wallet errors. */
export const WALLET_UNKNOWN_ERROR_DESC = "An unknown wallet error occurred.";

// ---------------------------------------------------------------------------
// Withdraw flow
// ---------------------------------------------------------------------------

export const WITHDRAW_NOTHING_AVAILABLE = "Nothing is withdrawable yet.";
export const WITHDRAW_AMOUNT_ZERO = "Enter an amount greater than zero.";

/**
 * Shown when the requested amount exceeds what the contract would accept.
 * @param available  Human-readable available amount with symbol (e.g. "1.23 XLM")
 */
export function withdrawExceedsAvailable(available: string): string {
  return (
    `Requested amount exceeds what's currently withdrawable on-chain (${available}). ` +
    `Refresh and try again.`
  );
}

export const WITHDRAW_CHECKING = "Checking on-chain balance…";
export const WITHDRAW_SIGNING = "Confirm in wallet…";
export const WITHDRAW_SUBMITTING = "Submitting…";
export const WITHDRAW_CONFIRM_BUTTON = "Confirm withdrawal";
export const WITHDRAW_SUCCESS_HEADING = "Withdrawal submitted";
export const WITHDRAW_VIEW_TX = "View transaction on Stellar Expert";

// ---------------------------------------------------------------------------
// Cancel flow
// ---------------------------------------------------------------------------

export const CANCEL_STREAM_NOT_FOUND = "Stream not found on-chain.";
export const CANCEL_COMPUTING_SPLIT = "Calculating exact split from chain…";
export const CANCEL_CONFIRM_BUTTON = "Yes, cancel stream";
export const CANCEL_KEEP_BUTTON = "Keep streaming";
export const CANCEL_SIGNING = "Confirm in wallet…";
export const CANCEL_SUCCESS = "Stream cancelled.";
export const CANCEL_VIEW_TX = "View transaction on Stellar Expert";
export const CANCEL_DIALOG_HEADING = "Cancel this stream?";
export const CANCEL_DIALOG_BODY =
  "This ends the stream immediately and splits the funds based on what has streamed so far. This cannot be undone.";
