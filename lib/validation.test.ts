import { describe, expect, it } from "vitest";
import { I128_MAX, checkAmount, checkRecipientNotSender, isValidStreamId } from "./validation";
import { parseAmountToBaseUnits } from "./format";
import { groupOutgoingByToken } from "./outgoing";

const base = (input: string, decimals = 7) => {
  const r = checkAmount(input, decimals);
  if (!r.ok) throw new Error(r.reason);
  return r.baseUnits;
};

describe("checkAmount", () => {
  it("converts valid input exactly", () => {
    expect(base("1")).toBe(10_000_000n);
    expect(base("1.5")).toBe(15_000_000n);
    expect(base("0.0000001")).toBe(1n);
    expect(base(".5")).toBe(5_000_000n);
    expect(base("1.")).toBe(10_000_000n);
    expect(base("  42  ")).toBe(420_000_000n);
  });

  it("respects the token's own decimals", () => {
    expect(base("25", 6)).toBe(25_000_000n);
    expect(base("1.234567", 6)).toBe(1_234_567n);
    expect(base("7", 0)).toBe(7n);
  });

  it("handles 0-decimal tokens correctly", () => {
    // whole numbers are accepted and return base units equal to the integer value
    expect(checkAmount("5", 0)).toEqual({ ok: true, baseUnits: 5n });
    // any fractional part, even '.0', is rejected with the no-decimal-places message
    expect(checkAmount("5.0", 0)).toEqual({ ok: false, reason: "This token has no decimal places; enter a whole number." });
    expect(checkAmount("5.1", 0)).toEqual({ ok: false, reason: "This token has no decimal places; enter a whole number." });
  });

  it("rejects more fractional digits than the token supports instead of silently truncating", () => {
    const r = checkAmount("1.123456789", 7);
    expect(r).toEqual({ ok: false, reason: "This token supports at most 7 decimal places." });
    expect(checkAmount("1.1234567", 6).ok).toBe(false);
    expect(checkAmount("1.5", 0)).toEqual({ ok: false, reason: "This token has no decimal places; enter a whole number." });
  });

  it("rejects amounts that look positive but are zero in base units", () => {
    // Number("0.00000001") > 0, yet this deposits nothing and the contract would reject it.
    expect(Number("0.00000001") > 0).toBe(true);
    expect(checkAmount("0", 7)).toEqual({ ok: false, reason: "Amount must be greater than zero." });
    expect(checkAmount("0.0000000", 7).ok).toBe(false);
    expect(checkAmount("0.00", 2).ok).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "abc", "-1", "1e5", "1.2.3", ".", "1,5", "0x10", "+1", "１２"]) {
      expect(checkAmount(bad, 7).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("keeps full precision for huge amounts and caps at i128", () => {
    expect(base("123456789012345678.1234567")).toBe(1234567890123456781234567n);
    expect(checkAmount("9".repeat(40), 7)).toEqual({ ok: false, reason: "Amount is too large." });
    expect(checkAmount(I128_MAX.toString(), 0)).toEqual({ ok: true, baseUnits: I128_MAX });
    expect(checkAmount((I128_MAX + 1n).toString(), 0).ok).toBe(false);
  });

  it("agrees with parseAmountToBaseUnits wherever the latter is exact", () => {
    for (const v of ["1", "0.5", "1000000.1234567", "0.0000001"]) {
      expect(base(v)).toBe(parseAmountToBaseUnits(v));
    }
  });
});

describe("checkAmount — invalid decimals", () => {
  it("returns an error result instead of throwing for non-integer decimals", () => {
    expect(() => checkAmount("1", 1.5)).not.toThrow();
    const r = checkAmount("1", 1.5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("Invalid token decimals.");
  });

  it("returns an error result instead of throwing for negative decimals", () => {
    expect(() => checkAmount("1", -1)).not.toThrow();
    const r = checkAmount("1", -1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("Invalid token decimals.");
  });

  it("rejects NaN and non-finite decimals", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = checkAmount("1", bad);
      expect(r.ok, String(bad)).toBe(false);
    }
  });
});

describe("checkRecipientNotSender", () => {
  it("blocks streaming to your own address", () => {
    expect(checkRecipientNotSender("GABC", "GABC")).toEqual({
      ok: false,
      reason: "The recipient can't be your own address.",
    });
  });
  it("allows other recipients, an empty field, and a disconnected wallet", () => {
    expect(checkRecipientNotSender("GOTHER", "GABC")).toEqual({ ok: true });
    expect(checkRecipientNotSender("", "GABC")).toEqual({ ok: true });
    expect(checkRecipientNotSender("GABC", null)).toEqual({ ok: true });
  });
});

describe("isValidStreamId", () => {
  it("accepts non-negative decimal integers, including a leading zero and large u64 values", () => {
    expect(isValidStreamId("0")).toBe(true);
    expect(isValidStreamId("1")).toBe(true);
    expect(isValidStreamId("42")).toBe(true);
    expect(isValidStreamId("007")).toBe(true);
    expect(isValidStreamId("18446744073709551615")).toBe(true); // u64::MAX
  });

  it("rejects anything that isn't a plain unsigned integer string", () => {
    for (const bad of ["abc", "", " ", "1.5", "-1", "+1", "1e3", "0x10", "1,000", "1 2", " 1", "1 "]) {
      expect(isValidStreamId(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

// ─── Issue #35: checkAmount — table-driven rejection tests ───────────────────

describe("checkAmount — explicit rejection reasons for common invalid formats", () => {
  const cases: [string, string][] = [
    ["0x10", "Enter a valid, non-negative number."],
    ["1e3",  "Enter a valid, non-negative number."],
    ["1,000", "Enter a valid, non-negative number."],
    ["+5",  "Enter a valid, non-negative number."],
  ];

  it.each(cases)("rejects %j with reason %j", (input, expectedReason) => {
    const result = checkAmount(input, 7);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(expectedReason);
    }
  });
});
