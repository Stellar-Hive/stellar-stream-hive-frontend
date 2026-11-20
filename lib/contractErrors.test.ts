import { describe, expect, it } from "vitest";
import {
  describeContractError,
  describeRpcError,
  isUnfundedAccountError,
  UNFUNDED_ACCOUNT_MESSAGE,
} from "./contractErrors";

describe("describeContractError", () => {
  it("maps #13 Paused to a friendly message", () => {
    expect(describeContractError("HostError: Error(Contract, #13)")).toBe(
      "New streams are temporarily paused.",
    );
  });

  it("maps #9 ExceedsWithdrawable to a friendly message", () => {
    expect(describeContractError("simulation failed: Error(Contract, #9)")).toBe(
      "Amount exceeds what is withdrawable.",
    );
  });

  it("maps every documented error code 1-13 to a non-empty message", () => {
    for (let code = 1; code <= 13; code += 1) {
      const message = describeContractError(`HostError: Error(Contract, #${code})`);
      expect(message).toBeTypeOf("string");
      expect(message!.length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unrecognized contract error code", () => {
    expect(describeContractError("HostError: Error(Contract, #999)")).toBeNull();
  });

  it("returns null when the message has no contract error code", () => {
    expect(describeContractError("Network request failed")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error intentionally testing a non-string input
    expect(describeContractError(undefined)).toBeNull();
  });
});

describe("describeRpcError", () => {
  it.each([
    ["Network Error", "We couldn't reach the Stellar network. Check your connection and try again."],
    ["tx_bad_seq", "Your transaction's sequence number is out of date. Try again."],
    ["tx_insufficient_fee", "The network fee was too low. Try again."],
    ["Account not found: GABC", UNFUNDED_ACCOUNT_MESSAGE],
    ["429 Too Many Requests", "The network is busy right now. Wait a moment and try again."],
  ])("maps %s to a friendly message and keeps the raw text in details", (raw, friendly) => {
    expect(describeRpcError(raw)).toEqual({ message: friendly, details: raw });
  });

  it("returns null for an unrecognized failure", () => {
    expect(describeRpcError("Something unexpected happened")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error intentionally testing a non-string input
    expect(describeRpcError(undefined)).toBeNull();
  });
});

describe("isUnfundedAccountError", () => {
  it("matches the RPC account-not-found message", () => {
    expect(isUnfundedAccountError("Account not found: GABC")).toBe(true);
  });

  it("does not match network failures", () => {
    expect(isUnfundedAccountError("Network Error")).toBe(false);
  });
});
