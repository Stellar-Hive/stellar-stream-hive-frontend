"use client";

import { useWallet } from "@/hooks/useWallet";
import { NETWORK } from "@/lib/stellar";

/**
 * Warns when the connected wallet is on a different network than the app.
 * Renders nothing while disconnected or when the wallet network is unknown,
 * since a mismatch cannot be confirmed in either case.
 */
export function NetworkBadge() {
  const { isConnected, network, isWrongNetwork } = useWallet();

  if (!isConnected || network === null || !isWrongNetwork) return null;

  return (
    <div role="alert" className="bg-red-100 p-3">
      Wrong network: wallet is on {network}, switch to {NETWORK}
    </div>
  );
}
