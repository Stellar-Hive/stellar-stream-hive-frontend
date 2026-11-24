import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// WalletProvider only needs the configured network from this module.
vi.mock("@/lib/stellar", () => ({ NETWORK: "TESTNET" }));

import { WalletContext } from "@/components/wallet/WalletProvider";
import { useWallet, type UseWalletResult } from "./useWallet";

function makeWalletValue(overrides: Partial<UseWalletResult> = {}): UseWalletResult {
  return {
    isConnected: true,
    publicKey: "GABC",
    network: "TESTNET",
    isFreighterInstalled: true,
    isConnecting: false,
    isDetecting: false,
    error: null,
    isWrongNetwork: false,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("useWallet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the value supplied by the nearest provider", () => {
    const value = makeWalletValue();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WalletContext.Provider, { value }, children);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current).toBe(value);
    expect(result.current.publicKey).toBe("GABC");
  });

  it("throws the documented error when used outside a WalletProvider", () => {
    // React logs the error thrown during render; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useWallet())).toThrow("useWallet must be used within a WalletProvider");
  });
});
