"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchStreamsByRecipient, fetchStreamsBySender, isApiConfigured } from "@/lib/api";
import type { Stream } from "@/types";

export type StreamRole = "sender" | "recipient";

export interface UseStreamsResult {
  streams: Stream[];
  isLoading: boolean;
  error: string | null;
  apiConfigured: boolean;
  /** Time (ms) of the last successful fetch for the current address and role, or null if none yet. */
  lastUpdatedAt: number | null;
  refetch: () => Promise<void>;
}

/**
 * Loads all streams where `address` plays `role` (sender or recipient), for
 * the /sending and /receiving pages. Backed by the indexer API — there is no
 * efficient way to enumerate "all streams for an address" directly from
 * on-chain contract storage, so this requires NEXT_PUBLIC_API_BASE_URL to be
 * configured; otherwise it resolves to an empty list and `apiConfigured` is
 * false so the page can explain why instead of pretending there's no data.
 */
export function useStreams(address: string | null, role: StreamRole): UseStreamsResult {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const load = useCallback(
    async (isStale: () => boolean = () => false) => {
      if (!address) {
        if (!isStale()) {
          setStreams([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const results = role === "sender" ? await fetchStreamsBySender(address) : await fetchStreamsByRecipient(address);
        if (isStale()) return;
        setStreams(results);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (isStale()) return;
        // A failed page (including any page after the first in a paged fetch)
        // rejects the whole request, so we never keep a partial list around.
        setError(err instanceof Error ? err.message : "Failed to load streams.");
        setStreams([]);
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    },
    [address, role],
  );

  useEffect(() => {
    let ignore = false;
    // A different address or role is a different list, so its freshness starts over.
    setLastUpdatedAt(null);
    load(() => ignore);
    return () => {
      ignore = true;
    };
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { streams, isLoading, error, apiConfigured: isApiConfigured(), lastUpdatedAt, refetch };
}
