/**
 * Pure helpers for the /sending and /receiving lists: status filtering,
 * per-status counts, and CSV export. Kept free of React so they're unit tested
 * directly (see `lib/streamList.test.ts`).
 */
import { format } from "date-fns";
import { formatBaseUnits } from "./format";
import type { Stream, StreamStatus } from "@/types";

export type StreamFilter = "all" | "live" | "completed" | "cancelled";

export const STREAM_FILTERS: { value: StreamFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** "Live" = anything that can still accrue or become withdrawable. */
const LIVE_STATUSES: ReadonlySet<StreamStatus> = new Set<StreamStatus>(["scheduled", "cliff", "active"]);

export function matchesFilter(stream: Stream, filter: StreamFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "live":
      return LIVE_STATUSES.has(stream.status);
    case "completed":
      return stream.status === "completed";
    case "cancelled":
      return stream.status === "cancelled";
  }
}

export function filterStreams(streams: Stream[], filter: StreamFilter): Stream[] {
  return filter === "all" ? streams : streams.filter((s) => matchesFilter(s, filter));
}

/**
 * Case-insensitive substring match against a stream's id, sender and recipient address. A blank
 * query returns the input unchanged.
 */
export function searchStreams(streams: Stream[], query: string): Stream[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return streams;
  return streams.filter((s) => [s.id, s.sender, s.recipient].some((field) => field.toLowerCase().includes(needle)));
}

export type StreamSort = "default" | "newest" | "ending" | "largest";

export const STREAM_SORTS: { value: StreamSort; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "newest", label: "Newest first" },
  { value: "ending", label: "Ending soonest" },
  { value: "largest", label: "Largest amount" },
];

/**
 * Returns a sorted copy; the input is never mutated. "newest" orders by start ledger, "ending" by
 * end ledger, and "largest" by total amount compared as BigInt so values beyond 2^53 stay exact.
 * "default" keeps the order the API returned.
 */
export function sortStreams(streams: Stream[], key: StreamSort): Stream[] {
  const sorted = [...streams];
  switch (key) {
    case "default":
      return sorted;
    case "newest":
      return sorted.sort((a, b) => b.startLedger - a.startLedger);
    case "ending":
      return sorted.sort((a, b) => a.endLedger - b.endLedger);
    case "largest":
      return sorted.sort((a, b) => {
        const diff = BigInt(b.totalAmount) - BigInt(a.totalAmount);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      });
  }
}

export function countByFilter(streams: Stream[]): Record<StreamFilter, number> {
  return {
    all: streams.length,
    live: streams.filter((s) => matchesFilter(s, "live")).length,
    completed: streams.filter((s) => matchesFilter(s, "completed")).length,
    cancelled: streams.filter((s) => matchesFilter(s, "cancelled")).length,
  };
}

const CSV_HEADER = [
  "id",
  "status",
  "sender",
  "recipient",
  "token",
  "total_amount",
  "withdrawn",
  "start_ledger",
  "end_ledger",
  "cliff_ledger",
  "cancellable",
];

/**
 * RFC 4180 escaping, plus a guard against spreadsheet formula injection:
 * a cell that starts with `=`, `+`, `-` or `@` is prefixed with a single quote
 * so it is never evaluated when the file is opened in Excel/Sheets.
 */
export function csvCell(value: string | number | boolean | undefined): string {
  let text = value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Export filename stamped with the local calendar date, so downloads on different days don't collide. */
export function csvFilename(exportName: string, date: Date = new Date()): string {
  return `${exportName}-${format(date, "yyyy-MM-dd")}.csv`;
}

/** Serializes streams to CSV. Amounts are human-readable decimals in the token's own units. */
export function streamsToCsv(streams: Stream[]): string {
  const rows = streams.map((s) => [
    s.id,
    s.status,
    s.sender,
    s.recipient,
    s.token.symbol,
    formatBaseUnits(BigInt(s.totalAmount), s.token.decimals, { grouped: false, minDecimals: 0 }),
    formatBaseUnits(BigInt(s.withdrawnAmount), s.token.decimals, { grouped: false, minDecimals: 0 }),
    s.startLedger,
    s.endLedger,
    s.cliffLedger,
    s.cancellable,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Serializes a single stream to JSON (amounts as decimal strings). */
export function streamToJson(stream: Stream): string {
  return JSON.stringify(
    {
      id: stream.id,
      status: stream.status,
      sender: stream.sender,
      recipient: stream.recipient,
      token: stream.token.symbol,
      totalAmount: formatBaseUnits(BigInt(stream.totalAmount), stream.token.decimals, {
        grouped: false,
        minDecimals: 0,
      }),
      withdrawnAmount: formatBaseUnits(BigInt(stream.withdrawnAmount), stream.token.decimals, {
        grouped: false,
        minDecimals: 0,
      }),
      startLedger: stream.startLedger,
      endLedger: stream.endLedger,
      cliffLedger: stream.cliffLedger,
      cancellable: stream.cancellable,
      startTime: new Date(stream.startTime).toISOString(),
      endTime: new Date(stream.endTime).toISOString(),
      cliffTime: stream.cliffTime !== undefined ? new Date(stream.cliffTime).toISOString() : null,
    },
    null,
    2
  );
}

/** Serializes a single stream to CSV. */
export function streamToCsv(stream: Stream): string {
  return streamsToCsv([stream]);
}
