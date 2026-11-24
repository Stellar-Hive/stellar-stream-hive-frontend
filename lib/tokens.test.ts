import { describe, expect, it, vi } from "vitest";
import type { Stream, StreamStatus, TokenInfo } from "@/types";

const NATIVE_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// Every token read goes through the RPC server; make it fail so unknown tokens take the fallback path.
vi.mock("./stellar", () => ({
  getSorobanServer: () => ({ simulateTransaction: vi.fn().mockRejectedValue(new Error("rpc unavailable")) }),
  nativeTokenContractId: () => NATIVE_ID,
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

import { getTokenInfo, summarizeOutgoingByToken, withTokenMetadata } from "./tokens";

const XLM: TokenInfo = { contractId: NATIVE_ID, symbol: "XLM", decimals: 7 };
const USDC: TokenInfo = { contractId: "CUSDC", symbol: "USDC", decimals: 6 };
const POINTS: TokenInfo = { contractId: "CPOINTS", symbol: "PTS", decimals: 0 };

const registry: Record<string, TokenInfo> = {
  [XLM.contractId]: XLM,
  [USDC.contractId]: USDC,
  [POINTS.contractId]: POINTS,
};
const lookup = (contractId: string): TokenInfo => registry[contractId];

function makeStream(
  token: TokenInfo,
  totalAmount: bigint,
  withdrawnAmount: bigint,
  status: StreamStatus = "active"
): Stream {
  return {
    id: `${token.symbol}-${totalAmount}-${status}`,
    sender: "GSENDER",
    recipient: "GRECIPIENT",
    token,
    totalAmount: totalAmount.toString(),
    withdrawnAmount: withdrawnAmount.toString(),
    startLedger: 1,
    endLedger: 100,
    startTime: 0,
    endTime: 1,
    cancellable: true,
    status,
  };
}

describe("summarizeOutgoingByToken", () => {
  it("returns no totals for an empty list", () => {
    expect(summarizeOutgoingByToken([], lookup)).toEqual({ totals: [], singleToken: true });
  });

  it("sums streams in the same token", () => {
    const summary = summarizeOutgoingByToken(
      [makeStream(XLM, 100n, 40n), makeStream(XLM, 50n, 0n)],
      lookup
    );
    expect(summary.totals).toEqual([{ contractId: XLM.contractId, symbol: "XLM", decimals: 7, amount: 110n }]);
    expect(summary.singleToken).toBe(true);
  });

  it("keeps two tokens separate instead of summing across them", () => {
    const summary = summarizeOutgoingByToken(
      [makeStream(XLM, 100n, 0n), makeStream(USDC, 7n, 2n), makeStream(XLM, 25n, 5n)],
      lookup
    );
    expect(summary.totals).toEqual([
      { contractId: XLM.contractId, symbol: "XLM", decimals: 7, amount: 120n },
      { contractId: USDC.contractId, symbol: "USDC", decimals: 6, amount: 5n },
    ]);
    expect(summary.singleToken).toBe(false);
  });

  it("handles a 0-decimal token", () => {
    const summary = summarizeOutgoingByToken([makeStream(POINTS, 12n, 2n), makeStream(POINTS, 3n, 0n)], lookup);
    expect(summary.totals).toEqual([{ contractId: POINTS.contractId, symbol: "PTS", decimals: 0, amount: 13n }]);
  });

  it("leaves out cancelled and completed streams", () => {
    const summary = summarizeOutgoingByToken(
      [
        makeStream(XLM, 100n, 0n, "active"),
        makeStream(XLM, 900n, 0n, "cancelled"),
        makeStream(XLM, 800n, 800n, "completed"),
        makeStream(XLM, 10n, 0n, "scheduled"),
        makeStream(XLM, 5n, 0n, "cliff"),
      ],
      lookup
    );
    expect(summary.totals).toEqual([{ contractId: XLM.contractId, symbol: "XLM", decimals: 7, amount: 115n }]);
  });

  it("returns no totals when every stream is finished", () => {
    const summary = summarizeOutgoingByToken(
      [makeStream(XLM, 100n, 0n, "cancelled"), makeStream(USDC, 5n, 5n, "completed")],
      lookup
    );
    expect(summary).toEqual({ totals: [], singleToken: true });
  });

  it("skips a stream whose token info is unknown", () => {
    const summary = summarizeOutgoingByToken(
      [makeStream(XLM, 10n, 0n), makeStream({ contractId: "CUNKNOWN", symbol: "?", decimals: 7 }, 99n, 0n)],
      lookup
    );
    expect(summary.totals).toHaveLength(1);
    expect(summary.totals[0].contractId).toBe(XLM.contractId);
  });
});

describe("getTokenInfo", () => {
  it("answers native XLM without reading the chain", async () => {
    await expect(getTokenInfo(NATIVE_ID)).resolves.toEqual(XLM);
  });

  it("falls back to TOKEN with 7 decimals when the token cannot be read", async () => {
    await expect(getTokenInfo("CUNKNOWNTOKEN")).resolves.toEqual({
      contractId: "CUNKNOWNTOKEN",
      symbol: "TOKEN",
      decimals: 7,
    });
  });
});

describe("withTokenMetadata", () => {
  it("replaces placeholder tokens: native gets XLM, an unreadable token gets the fallback", async () => {
    const placeholder = (contractId: string): TokenInfo => ({ contractId, symbol: "...", decimals: 7 });
    const streams = [
      makeStream(placeholder(NATIVE_ID), 10n, 0n),
      makeStream(placeholder("CUNKNOWNTOKEN"), 20n, 0n),
    ];

    const enriched = await withTokenMetadata(streams);

    expect(enriched[0].token).toEqual(XLM);
    expect(enriched[1].token).toEqual({ contractId: "CUNKNOWNTOKEN", symbol: "TOKEN", decimals: 7 });
    // Amounts and other fields are untouched, and the inputs are not mutated.
    expect(enriched[0].totalAmount).toBe("10");
    expect(streams[0].token.symbol).toBe("...");
  });
});
