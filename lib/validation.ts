/**
 * Pre-flight validation for the create-stream form.
 *
 * Anything the contract will reject but the form accepted costs the user a
 * wallet prompt and a failed transaction, so these checks mirror the contract's
 * own rules (positive i128 amount) and catch the cases where the UI would
 * otherwise silently change what is deposited.
 */

/** Largest value a Soroban `i128` amount can hold. */
export const I128_MAX = 2n ** 127n - 1n;

export type AmountCheck = { ok: true; baseUnits: bigint } | { ok: false; reason: string };

/**
 * Converts a human-entered decimal string into base units, exactly.
 *
 * Unlike `parseAmountToBaseUnits` (which floors extra precision), this rejects
 * input with more fractional digits than the token supports, and rejects
 * amounts that would be zero in base units -- e.g. "0.00000001" for a
 * 7-decimal token looks positive but deposits nothing.
 */
export function checkAmount(input: string, decimals: number): AmountCheck {
  if (!Number.isInteger(decimals) || decimals < 0) {
    return { ok: false, reason: "This token's decimal places are invalid." };
  }

  const text = input.trim();
  if (text === "") return { ok: false, reason: "Enter an amount." };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, reason: "Enter a valid, non-negative number." };

  const [whole = "", frac = ""] = text.split(".");
  if (frac.length > decimals) {
    return {
      ok: false,
      reason:
        decimals === 0
          ? "This token has no decimal places; enter a whole number."
          : `This token supports at most ${decimals} decimal places.`,
    };
  }

  const baseUnits = BigInt(whole === "" ? "0" : whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  if (baseUnits === 0n) return { ok: false, reason: "Amount must be greater than zero." };
  if (baseUnits > I128_MAX) return { ok: false, reason: "Amount is too large." };
  return { ok: true, baseUnits };
}

export type RecipientCheck = { ok: true } | { ok: false; reason: string };

/** Rejects streaming to yourself, which can never be what the sender intends. */
export function checkRecipientNotSender(recipient: string, sender: string | null): RecipientCheck {
  if (sender && recipient !== "" && recipient === sender) {
    return { ok: false, reason: "The recipient can't be your own address." };
  }
  return { ok: true };
}
