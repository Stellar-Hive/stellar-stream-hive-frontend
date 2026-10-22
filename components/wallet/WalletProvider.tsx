'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UseWalletResult } from '@/hooks/useWallet';

const WalletContext = createContext<UseWalletResult | null>(null);

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

  const checkFreighterInstalled = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        return false;
      }
      const freighter = (window as unknown as {
        freighter?: { isConnected?: () => Promise<boolean> };
      }).freighter;
      if (!freighter) {
        return false;
      }
      if (typeof freighter.isConnected === 'function') {
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
      const freighter = (window as unknown as {
        freighter?: {
          requestAccess?: () => Promise<{ address?: string } | string>;
          getNetwork?: () => Promise<string>;
        };
      }).freighter;

      if (!freighter) {
        setError('Freighter wallet is not installed.');
        return;
      }

      let address: string | null = null;
      if (typeof freighter.requestAccess === 'function') {
        const result = await freighter.requestAccess();
        if (typeof result === 'string') {
          address = result;
        } else if (result && typeof result.address === 'string') {
          address = result.address;
        }
      }

      if (!address) {
        setError('Unable to retrieve wallet address.');
        return;
      }

      let currentNetwork: string | null = null;
      if (typeof freighter.getNetwork === 'function') {
        try {
          currentNetwork = await freighter.getNetwork();
        } catch {
          currentNetwork = null;
        }
      }

      setPublicKey(address);
      setNetwork(currentNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet.');
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
        const freighter = (window as unknown as {
          freighter?: {
            getPublicKey?: () => Promise<string>;
            getNetwork?: () => Promise<string>;
          };
        }).freighter;

        if (freighter && typeof freighter.getPublicKey === 'function') {
          const address = await freighter.getPublicKey();
          if (cancelled) {
            return;
          }
          if (address) {
            setPublicKey(address);
            if (typeof freighter.getNetwork === 'function') {
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

  const value = useMemo<UseWalletResult>(
    () => ({
      isFreighterInstalled,
      isDetecting,
      publicKey,
      network,
      isConnecting,
      error,
      hydrated,
      connect,
      disconnect,
      clearError,
    }),
    [
      isFreighterInstalled,
      isDetecting,
      publicKey,
      network,
      isConnecting,
      error,
      hydrated,
      connect,
      disconnect,
      clearError,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): UseWalletResult {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletProvider;