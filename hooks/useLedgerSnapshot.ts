'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLatestLedgerSnapshot } from '@/lib/stellar';

/** How often the shared ledger snapshot re-syncs from Soroban RPC. */
export const RESYNC_MS = 30_000;

export interface LedgerSnapshot {
  /** Latest ledger sequence number, or null until the first fetch resolves. */
  reference: number | null;
  /** True until the first fetch resolves (or while a simulated reference is absent). */
  isLoading: boolean;
  /** Error from the most recent fetch, if any. */
  error: Error | null;
  /** Timestamp (ms) of the last successful sync, or null if never synced. */
  lastSyncedAt: number | null;
}

export interface UseLedgerSnapshotOptions {
  /**
   * When provided, short-circuits network access entirely and uses this
   * ledger number as the reference (landing page demo).
   */
  simulatedReference?: number | null;
  /**
   * When false, performs exactly one initial fetch (no interval) so that
   * completed/cancelled streams still get a real reference.
   * Defaults to true.
   */
  enabled?: boolean;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Shared ledger snapshot hook. Fetches the latest ledger once on mount and
 * re-syncs every {@link RESYNC_MS} while enabled. Multiple components using
 * this hook within the same page share the same polling cadence, avoiding
 * duplicate RPC calls.
 */
export function useLedgerSnapshot(
  options: UseLedgerSnapshotOptions = {},
): LedgerSnapshot {
  const { simulatedReference, enabled = true } = options;

  const hasSimulated =
    simulatedReference !== undefined && simulatedReference !== null;

  const [reference, setReference] = useState<number | null>(
    hasSimulated ? simulatedReference : null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(!hasSimulated);
  const [error, setError] = useState<Error | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    hasSimulated ? Date.now() : null,
  );

  const mountedRef = useRef(true);

  const fetchSnapshot = useCallback(async () => {
    try {
      const snapshot = await fetchLatestLedgerSnapshot();
      if (!mountedRef.current) return;
      setReference(snapshot);
      setError(null);
      setLastSyncedAt(Date.now());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(toError(err));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Simulated reference: no network access at all.
    if (hasSimulated) {
      setReference(simulatedReference ?? null);
      setIsLoading(false);
      setError(null);
      setLastSyncedAt(Date.now());
      return () => {
        mountedRef.current = false;
      };
    }

    // Always perform one initial fetch, even when disabled, so completed or
    // cancelled streams get a real reference instead of a fabricated zero.
    setIsLoading(true);
    void fetchSnapshot();

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    const interval = setInterval(() => {
      void fetchSnapshot();
    }, RESYNC_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [hasSimulated, simulatedReference, enabled, fetchSnapshot]);

  return { reference, isLoading, error, lastSyncedAt };
}

export default useLedgerSnapshot;