"use client";

import { useCallback, useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchStreamsByRecipient, fetchStreamsBySender, isApiConfigured } from "@/lib/api";
import type { Stream } from "@/types";

export type StreamRole = "sender" | "recipient";

export interface UseStreamsResult {
  streams: Stream[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  apiConfigured: boolean;
  /** Time (ms) of the last successful fetch for the current address and role, or null if none yet. */
  lastUpdatedAt: number | null;
  refetch: () => Promise<void>;
}

/** A background tab doesn't refetch; once visible again, data older than this triggers one refetch. */
const STALE_MS = 30_000;

function fetchPage(role: StreamRole, address: string, offset: number): Promise<StreamsPage> {
  return role === "sender" ? fetchStreamsBySenderPage(address, offset) : fetchStreamsByRecipientPage(address, offset);
}

/**
 * Loads streams where `address` plays `role` (sender or recipient), for the /sending and
 * /receiving pages. Backed by the indexer API — there is no efficient way to enumerate "all
 * streams for an address" directly from on-chain contract storage, so this requires
 * NEXT_PUBLIC_API_BASE_URL to be configured; otherwise it resolves to an empty list and
 * `apiConfigured` is false so the page can explain why instead of pretending there's no data.
 *
 * Loads one page (up to the API's page size) at a time; call `loadMore` to fetch the next page
 * when `hasMore` is true. Also refetches the first page when the tab regains visibility after
 * being hidden for longer than `STALE_MS`, so a list left open in a background tab doesn't go
 * stale indefinitely.
 */
export function useStreams(address: string | null, role: StreamRole): UseStreamsResult {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const load = useCallback(
    async (isStale: () => boolean = () => false) => {
      if (!address) {
        setStreams([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const results =
          role === "sender" ? await fetchStreamsBySender(address) : await fetchStreamsByRecipient(address);
        if (isStale()) return;
        setStreams(results);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (isStale()) return;
        // A failed page rejects the whole request, so we never keep a partial list around.
        setError(err instanceof Error ? err.message : "Failed to load streams.");
        setStreams([]);
        setTotal(null);
        setHasMore(false);
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    },
    [address, role]
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

  useEffect(() => {
    streamCountRef.current = streams.length;
  }, [streams.length]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const lastFetchedAt = lastFetchedAtRef.current;
      if (lastFetchedAt !== null && Date.now() - lastFetchedAt < STALE_MS) return;
      load();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!address) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(role, address, streamCountRef.current);
      setStreams((prev) => [...prev, ...page.streams]);
      setTotal(page.total);
      setHasMore(page.hasMore);
      lastFetchedAtRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more streams.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [address, role]);

  const refetch = useCallback(() => load(), [load]);

  return { streams, isLoading, error, apiConfigured: isApiConfigured(), lastUpdatedAt, refetch };
}
