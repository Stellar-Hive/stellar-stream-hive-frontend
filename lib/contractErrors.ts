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
