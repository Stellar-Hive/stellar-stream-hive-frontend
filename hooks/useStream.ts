"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
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

/** A background tab doesn't refetch; once visible again, data older than this triggers one refetch. */
const STALE_MS = 30_000;

/**
 * Loads a single stream by id, preferring the indexer API (fast, includes
 * derived status) and falling back to a direct on-chain read when the API is
 * unavailable or doesn't know about the stream yet.
 */
export function useStream(id: string): UseStreamResult {
  const [notConfigured, setNotConfigured] = useState(false);
  const lastFetchedAtRef = useRef<number | null>(null);

  const result = useAsync(
    async (isStale: () => boolean) => {
      setNotConfigured(false);
      const fromApi = await fetchStreamById(id);
      if (isStale()) return null;
      if (fromApi) {
        return fromApi;
      }

      if (!isStreamContractConfigured()) {
        setNotConfigured(true);
        return null;
      }

      const fromChain = await fetchStreamOnChain(id);
      if (isStale()) return null;
      if (!fromChain) {
        throw new Error("Stream not found.");
      }
      return fromChain;
    },
    [id]
  );

  return { stream: result.data, isLoading: result.isLoading, error: result.error, notConfigured, refetch: result.refetch };
}
