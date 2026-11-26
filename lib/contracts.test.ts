import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  ContractNotConfiguredError,
  getStreamContractId,
  isStreamContractConfigured,
  withdrawOnChain,
} from "./contracts";
import { UNFUNDED_ACCOUNT_MESSAGE } from "./contractErrors";

const { getAccount } = vi.hoisted(() => ({ getAccount: vi.fn() }));

vi.mock("./stellar", () => ({
  getSorobanServer: () => ({ getAccount }),
  fetchLatestLedgerSnapshot: vi.fn(async () => null),
  nativeTokenContractId: () => "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

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

describe("withdrawOnChain with an unfunded wallet", () => {
  const original = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
  const recipient = Keypair.random().publicKey();

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    getAccount.mockReset();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
    } else {
      process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = original;
    }
  });

  it("tells the user to fund a wallet the network does not know", async () => {
    getAccount.mockRejectedValueOnce(new Error(`Account not found: ${recipient}`));

    await expect(
      withdrawOnChain({ streamId: "1", recipient, amount: 1n }),
    ).rejects.toThrow(UNFUNDED_ACCOUNT_MESSAGE);
  });

  it("passes other RPC errors through unchanged", async () => {
    getAccount.mockRejectedValueOnce(new Error("Network Error"));

    await expect(
      withdrawOnChain({ streamId: "1", recipient, amount: 1n }),
    ).rejects.toThrow("Network Error");
  });
});
