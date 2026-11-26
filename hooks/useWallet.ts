"use client";

import { useContext } from "react";
import type { WalletState } from "@/types";
import { WalletContext, type WalletContextValue } from "@/components/wallet/WalletProvider";

export interface UseWalletResult extends WalletState {
  isConnecting: boolean;
  isDetecting: boolean;
  error: string | null;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

/**
 * Reads the shared Freighter wallet state from the nearest `WalletProvider`.
 * All components calling this hook observe the same connection, so connecting
 * or disconnecting anywhere updates every consumer immediately.
 */
export function useWallet(): UseWalletResult {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }

  return context as WalletContextValue;
}
