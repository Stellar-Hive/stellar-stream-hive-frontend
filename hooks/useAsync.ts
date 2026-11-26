"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseAsyncResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * A shared state machine for async operations with loading, error, refetch and stale-response handling.
 * Used by hooks that fetch data from APIs or contracts.
 */
export function useAsync<T>(
  loadFn: (isStale: () => boolean) => Promise<T | null>,
  dependencies: React.DependencyList,
  {
    onError = (err: unknown) => (err instanceof Error ? err.message : "Failed to load data."),
  }: {
    onError?: (err: unknown) => string;
  } = {},
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isStale: () => boolean = () => false) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await loadFn(isStale);
        if (isStale()) return;
        setData(result);
      } catch (err) {
        if (isStale()) return;
        setError(onError(err));
        setData(null);
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  );

  useEffect(() => {
    let ignore = false;
    load(() => ignore);
    return () => {
      ignore = true;
    };
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { data, isLoading, error, refetch };
}
