"use client";

import {
  STREAM_FILTERS,
  STREAM_SORTS,
  csvFilename,
  streamsToCsv,
  type StreamFilter,
  type StreamSort,
} from "@/lib/streamList";
import type { Stream } from "@/types";

interface StreamFilterBarProps {
  value: StreamFilter;
  onChange: (filter: StreamFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: StreamSort;
  onSortChange: (sort: StreamSort) => void;
  counts: Record<StreamFilter, number>;
  /** Streams to include in the CSV export (typically the currently visible list). */
  exportable: Stream[];
  exportName: string;
}

/** Filter tabs, search, a sort select, and a "Download CSV" action for the /sending and /receiving lists. */
export function StreamFilterBar({
  value,
  onChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  counts,
  exportable,
  exportName,
}: StreamFilterBarProps) {
  function downloadCsv() {
    const blob = new Blob([streamsToCsv(exportable)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename(exportName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Filter streams by status" className="flex flex-wrap gap-2">
        {STREAM_FILTERS.map((filter) => {
          const selected = filter.value === value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted hover:text-white"
              }`}
            >
              {filter.label} <span className="mono-tabular opacity-70">{counts[filter.value]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search by stream ID or address"
          placeholder="Search ID or address"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-56 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-muted"
        />
        <select
          aria-label="Sort streams"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as StreamSort)}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-muted transition-colors hover:text-white"
        >
          {STREAM_SORTS.map((option) => (
            <option key={option.value} value={option.value} className="bg-background">
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={exportable.length === 0}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
