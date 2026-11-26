import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_TIMEOUT_MS } from "./constants";
import { fetchPlatformStats, fetchStreamsBySender } from "./api";
import { fixtureStreams } from "./testing/handlers";

const BASE = "https://api.test.local";

function jsonResponse(body: unknown, total?: number): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (total !== undefined) headers.set("x-total-count", String(total));
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("fetchStreamsBySender pagination", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("fetches streams from MSW handler with correct pagination", async () => {
    const streams = await fetchStreamsBySender("GSENDER");

    expect(streams).toHaveLength(fixtureStreams.length);
    expect(streams.map((s) => s.id)).toEqual(fixtureStreams.map((v) => v.id));
  });

  it("maps fixture data to Stream objects with correct token info", async () => {
    const streams = await fetchStreamsBySender("GSENDER");

    const firstStream = streams[0];
    if (!firstStream) throw new Error("Expected at least one stream");
    expect(firstStream.id).toBe("1");
    expect(firstStream.sender).toBe(fixtureStreams[0]?.sender);
    expect(firstStream.recipient).toBe(fixtureStreams[0]?.recipient);
    expect(firstStream.totalAmount).toBe(fixtureStreams[0]?.total_amount);
    expect(firstStream.withdrawnAmount).toBe(fixtureStreams[0]?.withdrawn);
    expect(firstStream.status).toMatch(/active|cliff|scheduled|completed|cancelled/);
  });
});

describe("request timeout", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
  });

  it("gives up instead of hanging forever when the API never responds", async () => {
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultPromise = fetchPlatformStats();
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("API is not responding"));
  });
});
