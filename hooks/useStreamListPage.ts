"use client";

import { useMemo, useState } from "react";
import { useStreams, type StreamRole, type UseStreamsResult } from "@/hooks/useStreams";
import {
  countByFilter,
  filterStreams,
  searchStreams,
  sortStreams,
  type StreamFilter,
  type StreamSort,
} from "@/lib/streamList";
import type { Stream } from "@/types";

export interface UseStreamListPageResult extends UseStreamsResult {
  filter: StreamFilter;
  setFilter: (filter: StreamFilter) => void;
  query: string;
  setQuery: (query: string) => void;
  sort: StreamSort;
  setSort: (sort: StreamSort) => void;
  counts: Record<StreamFilter, number>;
  visibleStreams: Stream[];
}

/**
 * Shared state and derived list behind the /sending and /receiving pages:
 * fetching the role's streams, plus the filter/search/sort applied on top.
 * Extracted since both pages wired this up identically.
 */
export function useStreamListPage(address: string | null, role: StreamRole): UseStreamListPageResult {
  const streamsResult = useStreams(address, role);
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<StreamSort>("default");
  const counts = useMemo(() => countByFilter(streamsResult.streams), [streamsResult.streams]);
  const visibleStreams = useMemo(
    () => sortStreams(searchStreams(filterStreams(streamsResult.streams, filter), query), sort),
    [streamsResult.streams, filter, query, sort]
  );

  return { ...streamsResult, filter, setFilter, query, setQuery, sort, setSort, counts, visibleStreams };
}
