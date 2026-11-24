'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { UseWalletResult } from '@/hooks/useWallet';
import { NETWORK } from '@/lib/stellar';
import {
  WALLET_NOT_INSTALLED_ERROR,
  WALLET_NO_ADDRESS_ERROR,
  WALLET_CONNECT_FAILED_ERROR,
} from '@/lib/messages';

export type WalletContextValue = UseWalletResult;

export const WalletContext = createContext<WalletContextValue | null>(null);

export interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const watcherRef = useRef<(() => void) | null>(null);
  const networkRef = useRef<string | null>(null);

  const checkFreighterInstalled = useCallback(async () => {
    try {
      if (typeof window === "undefined") {
        return false;
      }
      const freighter = (
        window as unknown as {
          freighter?: { isConnected?: () => Promise<boolean> };
        }
      ).freighter;
      if (!freighter) {
        return false;
      }
      if (typeof freighter.isConnected === "function") {
        return await freighter.isConnected();
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const freighter = (
        window as unknown as {
          freighter?: {
            requestAccess?: () => Promise<{ address?: string } | string>;
            getNetwork?: () => Promise<string>;
          };
        }
      ).freighter;

      if (!freighter) {
        setError(WALLET_NOT_INSTALLED_ERROR);
        return;
      }

      let address: string | null = null;
      if (typeof freighter.requestAccess === "function") {
        const result = await freighter.requestAccess();
        if (typeof result === "string") {
          address = result;
        } else if (result && typeof result.address === "string") {
          address = result.address;
        }
      }

      if (!address) {
        setError(WALLET_NO_ADDRESS_ERROR);
        return;
      }

      let currentNetwork: string | null = null;
      if (typeof freighter.getNetwork === "function") {
        try {
          currentNetwork = await freighter.getNetwork();
        } catch {
          currentNetwork = null;
        }
      }

      setPublicKey(address);
      setNetwork(currentNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : WALLET_CONNECT_FAILED_ERROR);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setNetwork(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      const freighter = (window as unknown as {
        freighter?: {
          getPublicKey?: () => Promise<string>;
          getNetwork?: () => Promise<string>;
        };
      }).freighter;

      if (!freighter) return;

      let currentAddress: string | null = null;
      if (typeof freighter.getPublicKey === 'function') {
        currentAddress = await freighter.getPublicKey();
      }

      let currentNetwork: string | null = null;
      if (typeof freighter.getNetwork === 'function') {
        try {
          currentNetwork = await freighter.getNetwork();
        } catch {
          currentNetwork = null;
        }
      }

      if (currentAddress !== publicKey || currentNetwork !== network) {
        setPublicKey(currentAddress);
        setNetwork(currentNetwork);
      }
    } catch {
      // Silently ignore refresh failures
    }
  }, [publicKey, network]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const installed = await checkFreighterInstalled();
      if (cancelled) {
        return;
      }
      setIsFreighterInstalled(installed);
      setIsDetecting(false);

      if (!installed) {
        setHydrated(true);
        return;
      }

      try {
        const freighter = (
          window as unknown as {
            freighter?: {
              getPublicKey?: () => Promise<string>;
              getNetwork?: () => Promise<string>;
            };
          }
        ).freighter;

        if (freighter && typeof freighter.getPublicKey === "function") {
          const address = await freighter.getPublicKey();
          if (cancelled) {
            return;
          }
          if (address) {
            setPublicKey(address);
            if (typeof freighter.getNetwork === "function") {
              try {
                const currentNetwork = await freighter.getNetwork();
                if (!cancelled) {
                  setNetwork(currentNetwork);
                }
              } catch {
                if (!cancelled) {
                  setNetwork(null);
                }
              }
            }
          }
        }
      } catch {
        // Silently ignore restore failures; user can connect manually.
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [checkFreighterInstalled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isFreighterInstalled || !publicKey) {
      return;
    }

    const setupWatcher = () => {
      const freighter = (window as unknown as {
        freighter?: {
          watchAccount?: (callback: (address: string) => void) => () => void;
          watchNetwork?: (callback: (network: string) => void) => () => void;
        };
      }).freighter;

      let unsubscribeAccount: (() => void) | null = null;
      let unsubscribeNetwork: (() => void) | null = null;

      if (freighter?.watchAccount) {
        unsubscribeAccount = freighter.watchAccount((address) => {
          if (address !== publicKey) {
            setPublicKey(address);
          }
        });
      }

      if (freighter?.watchNetwork) {
        unsubscribeNetwork = freighter.watchNetwork((network) => {
          if (network !== networkRef.current) {
            setNetwork(network);
            networkRef.current = network;
          }
        });
      }

      const unsubscribe = () => {
        unsubscribeAccount?.();
        unsubscribeNetwork?.();
      };

      if (unsubscribeAccount || unsubscribeNetwork) {
        watcherRef.current = unsubscribe;
        return unsubscribe;
      }

      // Fallback: poll on visibility change
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void refreshWallet();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      watcherRef.current = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    };

    const unsubscribe = setupWatcher();
    return unsubscribe;
  }, [isFreighterInstalled, publicKey, refreshWallet]);

  useEffect(() => {
    return () => {
      watcherRef.current?.();
    };
  }, []);

  const value = useMemo<UseWalletResult>(
    () => {
      const isConnected = publicKey !== null;
      return {
        isFreighterInstalled,
        isDetecting,
        isConnected,
        publicKey,
        network,
        // Only meaningful once connected: Freighter reports the network it is on.
        isWrongNetwork: isConnected && network !== null && network !== NETWORK,
        isConnecting,
        error,
        connect,
        disconnect,
        clearError,
      };
    },
    [
      isFreighterInstalled,
      isDetecting,
      publicKey,
      network,
      isConnecting,
      error,
      connect,
      disconnect,
      clearError,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): UseWalletResult {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

export default WalletProvider;
