/**
 * Maps the Stream contract's typed Soroban errors (see the contract repo's
 * `docs/stream.md#errors`) to short, friendly sentences, so failed
 * simulations don't surface raw text like `HostError: Error(Contract, #13)`
 * to the user.
 */
const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: "This contract has already been initialized.",
  2: "This contract hasn't been initialized yet.",
  3: "You're not authorized to perform this action on this stream.",
  4: "The amount must be greater than zero.",
  5: "The end time must be after the start time.",
  6: "The cliff must fall between the stream's start and end time.",
  7: "That stream could not be found.",
  8: "That withdrawal isn't available yet.",
  9: "Amount exceeds what is withdrawable.",
  10: "This stream cannot be cancelled.",
  11: "This stream has already been cancelled or completed.",
  12: "That amount is too large to process safely.",
  13: "New streams are temporarily paused.",
};

/**
 * Extracts a Soroban contract error code (`Error(Contract, #N)`) from a raw
 * simulation/host error message and returns a friendly sentence for it, or
 * `null` if the message doesn't contain a recognized contract error code.
 */
export function describeContractError(message: string): string | null {
  if (typeof message !== "string") return null;

  const match = message.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (!match) return null;

  const code = Number(match[1]);
  return CONTRACT_ERROR_MESSAGES[code] ?? null;
}

/** A friendly sentence for an RPC or network failure, plus the raw text for a details area. */
export interface RpcErrorDescription {
  message: string;
  details: string;
}

/** Shown when the RPC reports a missing source account, which means it was never funded. */
export const UNFUNDED_ACCOUNT_MESSAGE = "This account is not funded yet. Fund it with Friendbot on testnet.";

const UNFUNDED_ACCOUNT_PATTERN = /tx_no_source_account|account not found/i;

export function isUnfundedAccountError(message: string): boolean {
  return typeof message === "string" && UNFUNDED_ACCOUNT_PATTERN.test(message);
}

const RPC_ERROR_RULES: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  {
    pattern: /tx_bad_seq|txBadSeq|bad sequence/i,
    message: "Your transaction's sequence number is out of date. Try again.",
  },
  {
    pattern: /tx_insufficient_fee|txInsufficientFee|insufficient fee/i,
    message: "The network fee was too low. Try again.",
  },
  {
    pattern: UNFUNDED_ACCOUNT_PATTERN,
    message: UNFUNDED_ACCOUNT_MESSAGE,
  },
  {
    pattern: /rate limit|too many requests|\b429\b/i,
    message: "The network is busy right now. Wait a moment and try again.",
  },
  {
    pattern: /network error|failed to fetch|fetch failed|econnrefused|enotfound|timeout|timed out/i,
    message: "We couldn't reach the Stellar network. Check your connection and try again.",
  },
];

/**
 * Maps a raw RPC or network failure message to a friendly sentence, keeping
 * the raw message as `details`. Returns `null` when no known failure matches.
 */
export function describeRpcError(message: string): RpcErrorDescription | null {
  if (typeof message !== "string") return null;

  const rule = RPC_ERROR_RULES.find(({ pattern }) => pattern.test(message));
  if (!rule) return null;

  return { message: rule.message, details: message };
}

/** Shown when a failed transaction carries no contract error code we can name. */
export const GENERIC_FAILED_TRANSACTION_MESSAGE = "Transaction failed on-chain. See Stellar Expert for details.";

/** Calls `target[method]()` when it is a function; undefined otherwise. Lets us probe XDR objects safely. */
function tryCall(target: unknown, method: string): unknown {
  const fn = (target as Record<string, unknown> | null | undefined)?.[method];
  return typeof fn === "function" ? (fn as () => unknown).call(target) : undefined;
}

/** The contract error code inside an `ScVal` error value (`Error(Contract, #N)`), or null. */
function contractCodeFromScVal(val: unknown): number | null {
  if ((tryCall(val, "switch") as { name?: string } | undefined)?.name !== "scvError") return null;
  const err = tryCall(val, "error");
  if ((tryCall(err, "type") as { name?: string } | undefined)?.name !== "sceContract") return null;
  const code = tryCall(err, "contractCode");
  return typeof code === "number" ? code : null;
}

/**
 * Reads a `getTransaction` result for a FAILED transaction and, when it holds a
 * Stream contract error code, returns the friendly sentence for it (via
 * `describeContractError`). Looks in the diagnostic events first (where Soroban
 * records the `Error(Contract, #N)` value), then in the response's text.
 * Returns null when no recognised contract error is present.
 */
export function contractErrorFromFailedTransaction(response: unknown): string | null {
  const events = (response as { diagnosticEventsXdr?: unknown } | null | undefined)?.diagnosticEventsXdr;
  if (Array.isArray(events)) {
    for (const event of events) {
      const v0 = tryCall(tryCall(tryCall(event, "event"), "body"), "v0");
      const topics = tryCall(v0, "topics");
      const candidates = [...(Array.isArray(topics) ? topics : []), tryCall(v0, "data")];
      for (const candidate of candidates) {
        const code = contractCodeFromScVal(candidate);
        if (code !== null) {
          const message = describeContractError(`Error(Contract, #${code})`);
          if (message) return message;
        }
      }
    }
  }

  try {
    const text = JSON.stringify(response, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    return typeof text === "string" ? describeContractError(text) : null;
  } catch {
    return null;
  }
}

/** The message to show for a FAILED transaction: the contract's own error when known, else the generic one. */
export function describeFailedTransaction(response: unknown): string {
  return contractErrorFromFailedTransaction(response) ?? GENERIC_FAILED_TRANSACTION_MESSAGE;
}
