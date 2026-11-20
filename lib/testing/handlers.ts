/**
 * MSW (Mock Service Worker) handlers for the Stellar Stream Hive API.
 *
 * Provides realistic fixture data with string amounts to match the indexer API format.
 * All token amounts are in base units (stroops) as decimal strings.
 *
 * Usage in tests:
 *   import { http, HttpResponse } from "msw";
 *   import { setupServer } from "msw/node";
 *   import { apiHandlers } from "@/lib/testing/handlers";
 *
 *   const server = setupServer(...apiHandlers);
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */

import { http, HttpResponse } from "msw";
import type { ApiReadiness, ApiStats, ApiStreamView } from "@/lib/streamMapping";

const API_BASE = "https://api.test.local";

/** Fixture streams with realistic amounts in base units (stroops). All floored, never rounded. */
export const fixtureStreams: ApiStreamView[] = [
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

export const fixtureStats: ApiStats = {
  total_streams: 3,
  active_streams: 1,
  total_streamed: "650000000",
  total_withdrawn: "25000000",
  total_value_locked: "625000000",
};

/** MSW handlers for all five API endpoints. */
export const apiHandlers = [
  http.get(`${API_BASE}/stats`, () => {
    return HttpResponse.json(fixtureStats);
  }),

  http.get(`${API_BASE}/ready`, () => {
    const ready: ApiReadiness = {
      synced: true,
      latest_ledger: 200000,
      contract_configured: true,
      indexed_streams: 3,
    };
    return HttpResponse.json(ready);
  }),

  http.get(`${API_BASE}/streams/:id`, ({ params }) => {
    const stream = fixtureStreams.find((s) => s.id === params.id);
    if (!stream) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(stream);
  }),

  http.get(`${API_BASE}/senders/:address`, ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 200;
    const offset = Number(url.searchParams.get("offset")) || 0;

    const allStreams = fixtureStreams;
    const page = allStreams.slice(offset, offset + limit);

    return HttpResponse.json(page, {
      headers: {
        "x-total-count": String(allStreams.length),
      },
    });
  }),

  http.get(`${API_BASE}/recipients/:address`, ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 200;
    const offset = Number(url.searchParams.get("offset")) || 0;

    const allStreams = fixtureStreams;
    const page = allStreams.slice(offset, offset + limit);

    return HttpResponse.json(page, {
      headers: {
        "x-total-count": String(allStreams.length),
      },
    });
  }),
];
