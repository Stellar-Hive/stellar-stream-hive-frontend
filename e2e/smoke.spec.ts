import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the three main page scenarios described in issue #262.
 * All Stellar network and API calls are intercepted via page.route() so
 * the tests never depend on Freighter, a live RPC endpoint, or a real API.
 */

const API_PATTERN = /\/api\/|\/senders\/|\/recipients\/|\/streams\/|\/stats|\/ready/;
const RPC_PATTERN = /soroban-testnet\.stellar\.org|rpc\.stellar\.org/;

/** A minimal stats response so the landing page renders without fabricated data. */
const STATS_BODY = {
  total_streams: 42,
  active_streams: 11,
  total_streamed: "500000000000",
  total_withdrawn: "120000000000",
  total_value_locked: "380000000000",
};

/** A minimal stream fixture used by the detail-page test. */
const STREAM_FIXTURE = {
  id: "smoke-1",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  total_amount: "10000000000",
  withdrawn: "2500000000",
  start_ledger: 100000,
  end_ledger: 200000,
  cliff_ledger: 100000,
  cancellable: true,
  status: "active" as const,
  created_at: Math.floor(Date.now() / 1000) - 86400 * 7,
  streamed_amount: "3000000000",
  withdrawable_amount: "500000000",
  progress_percent: 30,
};

test.describe("Landing page", () => {
  test("renders the hero heading and CTA buttons", async ({ page }) => {
    // Block RPC and API calls so the test is fully offline.
    await page.route(RPC_PATTERN, (route) => route.abort());
    await page.route("**/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS_BODY) })
    );
    await page.route("**/ready*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ synced: true, latest_ledger: 500000, contract_configured: false, indexed_streams: 42 }),
      })
    );

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /stream payments/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /create a stream/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view my streams/i })).toBeVisible();
  });
});

test.describe("Sending page — empty wallet state", () => {
  test("prompts wallet connection when no wallet is connected", async ({ page }) => {
    // With no NEXT_PUBLIC_API_BASE_URL set and no wallet, the page should
    // show the connect-wallet prompt without making any API calls.
    await page.route(RPC_PATTERN, (route) => route.abort());
    await page.route(API_PATTERN, (route) => route.abort());

    await page.goto("/sending");

    await expect(page.getByRole("heading", { name: /streams you're sending/i })).toBeVisible();
    // The connect-wallet prompt must be visible and no fabricated data shown.
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });
});

test.describe("Stream detail page", () => {
  test("renders stream details when the API returns a stream", async ({ page }) => {
    const streamId = STREAM_FIXTURE.id;

    // Mock the single-stream endpoint.
    await page.route(`**/streams/${streamId}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(STREAM_FIXTURE),
      })
    );
    // Mock the /ready endpoint so the app can get a ledger reference.
    await page.route("**/ready*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          synced: true,
          latest_ledger: 150000,
          contract_configured: false,
          indexed_streams: 1,
        }),
      })
    );
    // Block Soroban RPC calls — we don't need live contract reads.
    await page.route(RPC_PATTERN, (route) => route.abort());

    await page.goto(`/streams/${streamId}`);

    // The page should show the stream ID and the sender/recipient addresses.
    await expect(page.getByText(streamId)).toBeVisible();
  });

  test("shows an error state when the stream is not found", async ({ page }) => {
    await page.route("**/streams/missing-stream*", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) })
    );
    await page.route("**/ready*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ synced: true, latest_ledger: 150000, contract_configured: false, indexed_streams: 0 }),
      })
    );
    await page.route(RPC_PATTERN, (route) => route.abort());

    await page.goto("/streams/missing-stream");

    // The page must show an error state, never fabricated data.
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
