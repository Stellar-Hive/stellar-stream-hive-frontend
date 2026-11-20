"use client";

import { useAsync } from "@/hooks/useAsync";
import { fetchStreamsByRecipient, fetchStreamsBySender, isApiConfigured } from "@/lib/api";
import type { Stream } from "@/types";

export type StreamRole = "sender" | "recipient";

export interface UseStreamsResult {
  streams: Stream[];
  isLoading: boolean;
  error: string | null;
  apiConfigured: boolean;
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
  const result = useAsync(
    async (isStale: () => boolean) => {
      if (!address) {
        return [];
      }

      const streams =
        role === "sender" ? await fetchStreamsBySender(address) : await fetchStreamsByRecipient(address);
      if (isStale()) return null;
      return streams;
    },
    [address, role],
  );

  return { streams: result.data ?? [], isLoading: result.isLoading, error: result.error, apiConfigured: isApiConfigured(), refetch: result.refetch };
}
