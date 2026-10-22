"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchStreamById } from "@/lib/api";
import { fetchStreamOnChain, isStreamContractConfigured } from "@/lib/contracts";
import type { Stream } from "@/types";

export interface UseStreamResult {
  stream: Stream | null;
  isLoading: boolean;
  error: string | null;
  notConfigured: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads a single stream by id, preferring the indexer API (fast, includes
 * derived status) and falling back to a direct on-chain read when the API is
 * unavailable or doesn't know about the stream yet.
 */
export function useStream(id: string): UseStreamResult {
  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(
    async (isStale?: () => boolean) => {
      const stale = () => isStale?.() ?? false;
      setIsLoading(true);
      setError(null);
      setNotConfigured(false);
      try {
        const fromApi = await fetchStreamById(id);
        if (stale()) return;
        if (fromApi) {
          setStream(fromApi);
          return;
        }

        if (!isStreamContractConfigured()) {
          setNotConfigured(true);
          setStream(null);
          return;
        }

        const fromChain = await fetchStreamOnChain(id);
        if (stale()) return;
        if (!fromChain) {
          setError("Stream not found.");
          setStream(null);
          return;
        }
        setStream(fromChain);
      } catch (err) {
        if (stale()) return;
        setError(err instanceof Error ? err.message : "Failed to load stream.");
        setStream(null);
      } finally {
        if (!stale()) setIsLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    let ignore = false;
    load(() => ignore);
    return () => {
      ignore = true;
    };
  }, [load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return { stream, isLoading, error, notConfigured, refetch };
}
