import { describe, expect, it } from "vitest";
import { groupOutgoingByToken } from "./outgoingTotals";
import type { Stream } from "@/types";

function stream(contractId: string, total: string, withdrawn: string, overrides: Partial<Stream> = {}): Stream {
  return {
    id: `${contractId}-${total}`,
    sender: "GSENDER",
    recipient: "GRECIPIENT",
    token: { contractId, symbol: contractId, decimals: 7 },
    totalAmount: total,
    withdrawnAmount: withdrawn,
    startLedger: 1,
    endLedger: 2,
    startTime: 0,
    endTime: 0,
    cancellable: true,
    status: "active",
    ...overrides,
  };
}

describe("groupOutgoingByToken", () => {
  it("combines streams of one token into a single unpaid total", () => {
    const groups = groupOutgoingByToken([stream("USDC", "100", "40"), stream("USDC", "50", "0")]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ contractId: "USDC", symbol: "USDC", decimals: 7, amount: 110n });
  });

  it("keeps different tokens separate", () => {
    const groups = groupOutgoingByToken([
      stream("USDC", "100", "40"),
      stream("XLM", "50", "10"),
      stream("USDC", "5", "5"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.contractId === "USDC")?.amount).toBe(60n);
    expect(groups.find((g) => g.contractId === "XLM")?.amount).toBe(40n);
  });

  it("never goes negative when more has been withdrawn than the total", () => {
    const groups = groupOutgoingByToken([stream("USDC", "5", "9")]);

    expect(groups[0]?.amount).toBe(0n);
  });

  it("keeps full precision for amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const big = "170141183460469231731687303715884105727"; // i128::MAX
    const groups = groupOutgoingByToken([stream("USDC", big, "0"), stream("USDC", "1", "0")]);

    expect(groups[0]?.amount).toBe(BigInt(big) + 1n);
  });

  it("returns an empty list for no streams", () => {
    expect(groupOutgoingByToken([])).toEqual([]);
  });
});
