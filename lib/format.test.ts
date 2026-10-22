import { describe, expect, it } from "vitest";
import {
  formatBaseUnits,
  formatRate,
  formatTokenAmount,
  formatUtcOffset,
  parseAmountToBaseUnits,
  shortenAddress,
  stellarExpertAccountUrl,
  stellarExpertTxUrl,
} from "./format";

describe("parseAmountToBaseUnits", () => {
  it("converts whole and fractional amounts at 7 decimals", () => {
    expect(parseAmountToBaseUnits("1")).toBe(10_000_000n);
    expect(parseAmountToBaseUnits("1.5")).toBe(15_000_000n);
    expect(parseAmountToBaseUnits("0.0000001")).toBe(1n);
    expect(parseAmountToBaseUnits(".5")).toBe(5_000_000n);
  });

  it("floors excess precision rather than rounding", () => {
    expect(parseAmountToBaseUnits("0.00000019")).toBe(1n);
    expect(parseAmountToBaseUnits("1.99999999")).toBe(19_999_999n);
  });

  it("respects other decimals", () => {
    expect(parseAmountToBaseUnits("12.345678", 6)).toBe(12_345_678n);
    expect(parseAmountToBaseUnits("1", 0)).toBe(1n);
  });

  it("keeps full precision above Number.MAX_SAFE_INTEGER", () => {
    expect(parseAmountToBaseUnits("123456789012345678.1234567")).toBe(1234567890123456781234567n);
  });

  it("rejects empty, non-numeric and negative input", () => {
    expect(() => parseAmountToBaseUnits("")).toThrow("Invalid amount");
    expect(() => parseAmountToBaseUnits("abc")).toThrow("Invalid amount");
    expect(() => parseAmountToBaseUnits("-1")).toThrow("negative");
  });
});

describe("formatBaseUnits", () => {
  it("groups thousands and keeps at least two decimals", () => {
    expect(formatBaseUnits(12_345_678_900_000n)).toBe("1,234,567.89");
    expect(formatBaseUnits(0n)).toBe("0.00");
  });

  it("trims trailing zeros beyond the minimum", () => {
    expect(formatBaseUnits(15_000_000n)).toBe("1.50");
    expect(formatBaseUnits(12_345_000n)).toBe("1.2345");
  });

  it("truncates instead of rounding up", () => {
    expect(formatBaseUnits(19_999_999n, 7, { maxDecimals: 2 })).toBe("1.99");
  });

  it("handles negatives and ungrouped output", () => {
    expect(formatBaseUnits(-15_000_000n)).toBe("-1.50");
    expect(formatBaseUnits(12_345_678_900_000n, 7, { grouped: false })).toBe("1234567.89");
  });

  it("round-trips with parseAmountToBaseUnits", () => {
    for (const v of ["0.0000001", "1", "42.4242424", "1000000.1234567"]) {
      expect(formatBaseUnits(parseAmountToBaseUnits(v), 7, { grouped: false, minDecimals: 0 })).toBe(v);
    }
  });
});

describe("formatTokenAmount", () => {
  it("appends the symbol", () => {
    expect(formatTokenAmount(15_000_000n, "XLM")).toBe("1.50 XLM");
    expect(formatTokenAmount(12_345_678n, "USDC", 7, 4)).toBe("1.2345 USDC");
  });
});

describe("shortenAddress", () => {
  const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  it("keeps the ends", () => {
    expect(shortenAddress(addr)).toBe("GAAZ…CWN7");
    expect(shortenAddress(addr, 6, 6)).toBe("GAAZI4…OCCWN7");
  });
  it("leaves short or empty strings alone", () => {
    expect(shortenAddress("GABC")).toBe("GABC");
    expect(shortenAddress("")).toBe("");
  });

  it("shortens with lead=6, trail=6", () => {
    // addr is 56 chars; slices [0,6] and [-6] = "GAAZI4" and "OCCWN7"
    expect(shortenAddress(addr, 6, 6)).toBe("GAAZI4…OCCWN7");
  });

  it("shortens with lead=0, trail=4", () => {
    // lead=0 means no leading chars, only trailing shown after ellipsis
    expect(shortenAddress(addr, 0, 4)).toBe("…CWN7");
  });

  it("returns the address unchanged when it is exactly at the shortening threshold", () => {
    // threshold = lead + trail + 3; address of exactly that length is NOT shortened
    // default lead=4, trail=4 → threshold = 11; a string of length 11 is returned as-is
    const threshold = 4 + 4 + 3; // 11
    const exact = "GABCDEFGHIJ"; // length 11
    expect(exact.length).toBe(threshold);
    expect(shortenAddress(exact)).toBe(exact);
  });

  it("shortens an address one character above the threshold", () => {
    // length 12 (threshold + 1) must be shortened with default lead=4, trail=4
    const aboveThreshold = "GABCDEFGHIJK"; // length 12
    expect(aboveThreshold.length).toBe(4 + 4 + 3 + 1);
    expect(shortenAddress(aboveThreshold)).toBe("GABC…HIJK");
  });
});

describe("explorer urls", () => {
  it("picks account vs contract from the address prefix", () => {
    expect(stellarExpertAccountUrl("GABC")).toBe("https://stellar.expert/explorer/testnet/account/GABC");
    expect(stellarExpertAccountUrl("CABC", "public")).toBe("https://stellar.expert/explorer/public/contract/CABC");
  });
  it("links transactions", () => {
    expect(stellarExpertTxUrl("abc123")).toBe("https://stellar.expert/explorer/testnet/tx/abc123");
  });

  it("builds public-network account URL for a G… address", () => {
    const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
    expect(stellarExpertAccountUrl(addr, "public")).toBe(
      `https://stellar.expert/explorer/public/account/${addr}`
    );
  });

  it("builds public-network contract URL for a C… address", () => {
    const contract = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
    expect(stellarExpertAccountUrl(contract, "public")).toBe(
      `https://stellar.expert/explorer/public/contract/${contract}`
    );
  });

  it("builds public-network transaction URL for a tx hash", () => {
    const hash = "6bc97b2f36b2f6f1a7f1e4cbe6cd2b0d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8";
    expect(stellarExpertTxUrl(hash, "public")).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`
    );
  });

  it("returns null for account/contract URLs when network is null (e.g. Futurenet)", () => {
    expect(stellarExpertAccountUrl("GABC", null)).toBeNull();
    expect(stellarExpertAccountUrl("CABC", null)).toBeNull();
  });

  it("returns null for transaction URLs when network is null (e.g. Futurenet)", () => {
    expect(stellarExpertTxUrl("abc123", null)).toBeNull();
  });
});

describe("formatRate", () => {
  it("scales a per-second rate to hour and day", () => {
    const r = formatRate(2, "XLM");
    expect(r.perSecond).toBe("2.0000 XLM");
    expect(r.perHour).toBe("7200.00 XLM");
    expect(r.perDay).toBe("172800.00 XLM");
  });
  it("copes with zero and non-finite rates", () => {
    expect(formatRate(0, "XLM").perDay).toBe("0 XLM");
    expect(formatRate(Number.NaN, "XLM").perSecond).toBe("0 XLM");
  });
});

describe("formatUtcOffset", () => {
  const winter = new Date("2026-01-15T12:00:00Z");

  it("formats whole-hour and half-hour offsets", () => {
    expect(formatUtcOffset(winter, "Asia/Kolkata")).toBe("UTC+5:30");
    expect(formatUtcOffset(winter, "America/St_Johns")).toBe("UTC-3:30");
    expect(formatUtcOffset(winter, "Africa/Lagos")).toBe("UTC+1");
    expect(formatUtcOffset(winter, "America/New_York")).toBe("UTC-5");
  });

  it("uses UTC+0 for zones with no offset", () => {
    expect(formatUtcOffset(winter, "UTC")).toBe("UTC+0");
  });

  it("reflects daylight saving time for the given instant", () => {
    const summer = new Date("2026-07-15T12:00:00Z");
    expect(formatUtcOffset(winter, "America/New_York")).toBe("UTC-5");
    expect(formatUtcOffset(summer, "America/New_York")).toBe("UTC-4");
  });

  it("returns null for an unknown timezone instead of throwing", () => {
    expect(formatUtcOffset(winter, "Not/A_Zone")).toBeNull();
  });
});

// ─── Issue #34: parseAmountToBaseUnits — additional edge inputs ───────────────

describe("parseAmountToBaseUnits — edge inputs", () => {
  it("trims leading and trailing whitespace", () => {
    expect(parseAmountToBaseUnits(" 12 ")).toBe(120_000_000n);
  });

  it("handles a trailing decimal point (no fractional part)", () => {
    // "5." splits into whole="5", frac="" → treated as "0000000"
    expect(parseAmountToBaseUnits("5.")).toBe(50_000_000n);
  });

  it("returns zero for the string '0'", () => {
    expect(parseAmountToBaseUnits("0")).toBe(0n);
  });

  it("works correctly for a 0-decimal token", () => {
    // decimals=0: factor=1, frac="" → 0; whole contributes directly
    expect(parseAmountToBaseUnits("42", 0)).toBe(42n);
    expect(parseAmountToBaseUnits("0", 0)).toBe(0n);
  });
});

// ─── Issue #30: formatBaseUnits — additional edge cases ──────────────────────

describe("formatBaseUnits — edge cases", () => {
  it("formats a 0-decimal token (returns whole number with minDecimals padding)", () => {
    // decimals=0 → no fractional component possible; minDecimals=2 pads with ".00"
    expect(formatBaseUnits(5n, 0)).toBe("5.00");
    expect(formatBaseUnits(0n, 0)).toBe("0.00");
    expect(formatBaseUnits(1000n, 0)).toBe("1,000.00");
  });

  it("handles amounts smaller than one unit", () => {
    // 1 stroop = 0.0000001 XLM
    expect(formatBaseUnits(1n, 7)).toBe("0.0000001");
    expect(formatBaseUnits(9n, 7)).toBe("0.0000009");
  });

  it("documents behaviour when maxDecimals < minDecimals (truncate then pad)", () => {
    // maxDecimals=1 truncates to 1 sig digit, then minDecimals=3 pads to 3 chars.
    // "1.5000000" → truncate to "5" → pad to "500" → trim stops at minDecimals → "1.500"
    expect(formatBaseUnits(15_000_000n, 7, { maxDecimals: 1, minDecimals: 3 })).toBe("1.500");
    // maxDecimals=0 → frac="" → pad to minDecimals=3 → "000" → no trimming → "5.000"
    expect(formatBaseUnits(50_000_000n, 7, { maxDecimals: 0, minDecimals: 3 })).toBe("5.000");
  });
});

// ─── Issue #33: formatRate — boundary tests ──────────────────────────────────

describe("formatRate — notation boundaries", () => {
  it("uses exponential notation below 0.0000001", () => {
    // 5e-8 < 0.0000001 → toExponential(2)
    expect(formatRate(5e-8, "XLM").perSecond).toBe("5.00e-8 XLM");
    // 9.9e-8 < 0.0000001 → toExponential(2)
    expect(formatRate(9.9e-8, "XLM").perSecond).toBe("9.90e-8 XLM");
  });

  it("switches to toFixed(7) at and above 0.0000001", () => {
    // exactly at threshold: not < 0.0000001 → toFixed(7) since < 1
    expect(formatRate(0.0000001, "XLM").perSecond).toBe("0.0000001 XLM");
    // just above: 2e-7 → toFixed(7)
    expect(formatRate(2e-7, "XLM").perSecond).toBe("0.0000002 XLM");
  });

  it("switches from toFixed(7) to toFixed(4) at 1", () => {
    // 0.5 < 1 → toFixed(7)
    expect(formatRate(0.5, "XLM").perSecond).toBe("0.5000000 XLM");
    // 1.0: not < 1, < 100 → toFixed(4)
    expect(formatRate(1, "XLM").perSecond).toBe("1.0000 XLM");
    // 1.5: toFixed(4)
    expect(formatRate(1.5, "XLM").perSecond).toBe("1.5000 XLM");
  });

  it("switches from toFixed(4) to toFixed(2) at 100", () => {
    // 99.9999 < 100 → toFixed(4)
    expect(formatRate(99.9999, "XLM").perSecond).toBe("99.9999 XLM");
    // 100: not < 100 → toFixed(2)
    expect(formatRate(100, "XLM").perSecond).toBe("100.00 XLM");
    // 150: toFixed(2)
    expect(formatRate(150, "XLM").perSecond).toBe("150.00 XLM");
  });

  it("treats negative rates as below the 0.0000001 threshold (exponential)", () => {
    // -1 < 0.0000001 is true → toExponential(2)
    expect(formatRate(-1, "XLM").perSecond).toBe("-1.00e+0 XLM");
  });

  it("treats Infinity as non-finite and returns zero", () => {
    expect(formatRate(Infinity, "XLM").perSecond).toBe("0 XLM");
    expect(formatRate(-Infinity, "XLM").perSecond).toBe("0 XLM");
  });
});
