import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ContractNotConfiguredError, getStreamContractId, isStreamContractConfigured } from "./contracts";

describe("getStreamContractId", () => {
  const original = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
    } else {
      process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = original;
    }
  });

  it("throws ContractNotConfiguredError when the env var is unset", () => {
    expect(() => getStreamContractId()).toThrow(ContractNotConfiguredError);
  });

  it("throws ContractNotConfiguredError when the env var is empty", () => {
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "";
    expect(() => getStreamContractId()).toThrow(ContractNotConfiguredError);
  });

  it("reports the Stream contract name on the thrown error", () => {
    try {
      getStreamContractId();
      throw new Error("expected getStreamContractId to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ContractNotConfiguredError);
      expect((err as ContractNotConfiguredError).contractName).toBe("Stream");
    }
  });

  it("returns the configured contract id when set", () => {
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "CABC123";
    expect(getStreamContractId()).toBe("CABC123");
  });
});

describe("isStreamContractConfigured", () => {
  const original = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
    } else {
      process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = original;
    }
  });

  it("returns false when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
    expect(isStreamContractConfigured()).toBe(false);
  });

  it("returns false when the env var is empty", () => {
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "";
    expect(isStreamContractConfigured()).toBe(false);
  });

  it("returns true when the env var is set", () => {
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "CABC123";
    expect(isStreamContractConfigured()).toBe(true);
  });
});
