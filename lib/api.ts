/**
 * Client for the Stellar Stream Hive indexer API
 * (https://github.com/Stellar-Hive/stellar-stream-hive-api).
 *
 * Endpoints used (see the API's docs for the full reference):
 *
 *   GET /stats                  platform-wide aggregates
 *   GET /ready                  indexer sync state + latest ledger
 *   GET /streams/:id            one stream
 *   GET /senders/:address       streams sent by an address
 *   GET /recipients/:address    streams received by an address
 *
 * The list endpoints are paginated (`limit` <= 200, `offset`) and report the
 * unpaginated size in the `X-Total-Count` header; `fetchAllPages` walks them.
 *
 * NEXT_PUBLIC_API_BASE_URL is optional. When it is not configured (e.g.
 * during early development before the API is deployed), every function here
 * resolves to `null` / an empty list rather than throwing, so pages can show
 * a graceful loading/empty state instead of fabricating data.
 *
 * NEXT_PUBLIC_MOCK_DATA is an opt-in development flag (only available in dev/preview
 * builds, never in production) that serves realistic fixture data instead of
 * making real API calls. The UI is clearly labeled as showing mock data.
 */
import { nativeTokenContractId } from "./stellar";
import { withTokenMetadata } from "./tokens";
import {
  makeTokenResolver,
  mapApiStats,
  mapApiStream,
  type ApiReadiness,
  type ApiStats,
  type ApiStreamView,
  type LedgerReference,
} from "./streamMapping";
import type { PlatformStats, Stream } from "@/types";

const PAGE_SIZE = 200;
/** Safety valve so a misbehaving server can never make us loop forever. */
const MAX_PAGES = 25;

/**
 * Mock data fixtures for development. Realistic amounts in base units (stroops),
 * using decimal strings to preserve BigInt precision. All amounts are floored,
 * never rounded.
 */
const MOCK_STREAMS: ApiStreamView[] = [
  {
    id: "1",
    sender: "GSENDER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
    recipient: "GRECIPIENT123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123",
    token: "CDQOHF7SA3XVQ5LKG4MAXMHAQVWQQPQC7JJUL6CLQTQX6WJMFPQPQTS",
    total_amount: "100000000",
    withdrawn: "25000000",
    start_ledger: 100000,
    end_ledger: 200000,
    cliff_ledger: 150000,
    cancellable: true,
    status: "active",
    created_at: Math.floor(Date.now() / 1000) - 86400 * 30,
    streamed_amount: "50000000",
    withdrawable_amount: "25000000",
    progress_percent: 50,
  },
  {
    id: "2",
    sender: "GSENDER234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678",
    recipient: "GRECIPIENT234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
    token: "CDQOHF7SA3XVQ5LKG4MAXMHAQVWQQPQC7JJUL6CLQTQX6WJMFPQPQTS",
    total_amount: "500000000",
    withdrawn: "0",
    start_ledger: 100000,
    end_ledger: 150000,
    cliff_ledger: 100000,
    cancellable: false,
    status: "completed",
    created_at: Math.floor(Date.now() / 1000) - 86400 * 60,
    streamed_amount: "500000000",
    withdrawable_amount: "500000000",
    progress_percent: 100,
  },
  {
    id: "3",
    sender: "GSENDER345678901ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
    recipient: "GRECIPIENT345678901ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
    token: "CDQOHF7SA3XVQ5LKG4MAXMHAQVWQQPQC7JJUL6CLQTQX6WJMFPQPQTS",
    total_amount: "50000000",
    withdrawn: "0",
    start_ledger: 100000,
    end_ledger: 120000,
    cliff_ledger: 110000,
    cancellable: true,
    status: "cancelled",
    created_at: Math.floor(Date.now() / 1000) - 86400 * 90,
    streamed_amount: "25000000",
    withdrawable_amount: "10000000",
    progress_percent: 50,
  },
];

const MOCK_STATS: ApiStats = {
  total_streams: 3,
  active_streams: 1,
  total_streamed: "650000000",
  total_withdrawn: "25000000",
  total_value_locked: "625000000",
};

function useMockData(): boolean {
  // Only allow mock mode in development builds, never in production
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.NEXT_PUBLIC_MOCK_DATA === "1";
}

function apiBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  return url && url.trim() !== "" ? url.replace(/\/$/, "") : null;
}

export function isApiConfigured(): boolean {
  return useMockData() || apiBaseUrl() !== null;
}

async function apiFetchResponse(path: string, init?: RequestInit): Promise<Response | null> {
  if (useMockData()) {
    return mockFetchResponse(path);
  }

  const base = apiBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

function mockFetchResponse(path: string): Response {
  const headers = new Headers({ "content-type": "application/json" });

  if (path === "/stats") {
    headers.set("x-total-count", "1");
    return new Response(JSON.stringify(MOCK_STATS), { status: 200, headers });
  }

  if (path === "/ready") {
    const readiness: ApiReadiness = {
      synced: true,
      latest_ledger: 200000,
      contract_configured: true,
      indexed_streams: 3,
    };
    return new Response(JSON.stringify(readiness), { status: 200, headers });
  }

  if (path.startsWith("/streams/")) {
    const id = path.split("/").pop();
    const stream = MOCK_STREAMS.find((s) => s.id === id);
    if (stream) {
      return new Response(JSON.stringify(stream), { status: 200, headers });
    }
    return new Response(JSON.stringify(null), { status: 404, headers });
  }

  if (path.includes("/senders/") || path.includes("/recipients/")) {
    headers.set("x-total-count", String(MOCK_STREAMS.length));
    return new Response(JSON.stringify(MOCK_STREAMS), { status: 200, headers });
  }

  return new Response(JSON.stringify([]), { status: 404, headers });
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const res = await apiFetchResponse(path);
  if (!res) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Reads the indexer's latest ledger, paired with the local time it was observed. */
async function fetchLedgerReference(): Promise<LedgerReference | null> {
  const ready = await apiFetch<ApiReadiness>("/ready");
  if (!ready || !ready.synced) return null;
  return { ledger: ready.latest_ledger, timestampMs: Date.now() };
}

/** Fetches platform-wide stats for the landing page. Returns null if the API is unreachable/unconfigured. */
export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  const stats = await apiFetch<ApiStats>("/stats");
  return stats ? mapApiStats(stats) : null;
}

/**
 * Walks a paginated list endpoint until the server's `X-Total-Count` is
 * exhausted (or a short page is returned), concatenating the pages.
 *
 * The first page failing (or the API being unconfigured) yields an empty
 * list so callers can show a graceful empty state. A failure on any later
 * page throws instead of returning a silently partial list.
 */
async function fetchAllPages(path: string): Promise<ApiStreamView[]> {
  const all: ApiStreamView[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await apiFetchResponse(`${path}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
    if (!res) {
      if (page === 0) break;
      throw new Error(`Failed to load page ${page + 1} of ${path}`);
    }

    let batch: ApiStreamView[];
    try {
      batch = (await res.json()) as ApiStreamView[];
    } catch {
      if (page === 0) break;
      throw new Error(`Failed to load page ${page + 1} of ${path}`);
    }
    all.push(...batch);

    const total = Number(res.headers.get("x-total-count"));
    if (batch.length < PAGE_SIZE || (Number.isFinite(total) && all.length >= total)) break;
  }
  return all;
}

async function fetchStreamList(path: string): Promise<Stream[]> {
  const [views, reference] = await Promise.all([fetchAllPages(path), fetchLedgerReference()]);
  const resolveToken = makeTokenResolver(nativeTokenContractId());
  return withTokenMetadata(views.map((v) => mapApiStream(v, reference, resolveToken)));
}

/** Fetches streams where `address` is the sender. */
export async function fetchStreamsBySender(address: string): Promise<Stream[]> {
  return fetchStreamList(`/senders/${encodeURIComponent(address)}`);
}

/** Fetches streams where `address` is the recipient. */
export async function fetchStreamsByRecipient(address: string): Promise<Stream[]> {
  return fetchStreamList(`/recipients/${encodeURIComponent(address)}`);
}

/** Fetches a single stream by id from the indexer (faster than a chain read, used for initial page load). */
export async function fetchStreamById(id: string): Promise<Stream | null> {
  const [view, reference] = await Promise.all([
    apiFetch<ApiStreamView>(`/streams/${encodeURIComponent(id)}`),
    fetchLedgerReference(),
  ]);
  if (!view) return null;
  const [stream] = await withTokenMetadata([mapApiStream(view, reference, makeTokenResolver(nativeTokenContractId()))]);
  return stream;
}
