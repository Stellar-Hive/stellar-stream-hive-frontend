import { describe, expect, it } from "vitest";
import { describeContractError } from "./contractErrors";

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
