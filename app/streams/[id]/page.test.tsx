import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Stream, WalletState } from "@/types";
import type { UseStreamResult } from "@/hooks/useStream";

const hooks = vi.hoisted(() => ({
  useStream: vi.fn<(id: string) => UseStreamResult>(),
  useWallet: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/hooks/useStream", () => ({ useStream: hooks.useStream }));
vi.mock("@/hooks/useWallet", () => ({ useWallet: hooks.useWallet }));
vi.mock("next/navigation", () => ({ notFound: hooks.notFound }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));

// Live-ticking balance widgets read the ledger; they are not under test here.
vi.mock("@/components/stream/LiveBalance", () => ({ LiveBalance: () => <div data-testid="live-balance" /> }));
vi.mock("@/components/stream/StreamProgress", () => ({ StreamProgress: () => <div data-testid="progress" /> }));
vi.mock("@/components/stream/StreamTimeline", () => ({ StreamTimeline: () => <div data-testid="timeline" /> }));
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    fetchLatestLedgerSnapshot: vi.fn(async () => ({ ledger: 1_000, timestampMs: Date.now() })),
  };
});

import StreamDetailPage from "./page";
import StreamDetailLayout from "./layout";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const THIRD_PARTY = "GCTHIRDPARTYTHIRDPARTYTHIRDPARTYTHIRDPARTYTHIRDPARTYAB";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: "42",
    sender: SENDER,
    recipient: RECIPIENT,
    token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
    totalAmount: "15000000",
    withdrawnAmount: "5000000",
    startLedger: 100,
    endLedger: 2_000,
    startTime: Date.UTC(2026, 0, 1),
    endTime: Date.UTC(2026, 0, 31),
    cancellable: true,
    status: "active",
    ...overrides,
  };
}

function walletAs(publicKey: string | null): WalletState & Record<string, unknown> {
  return {
    isConnected: publicKey !== null,
    publicKey,
    network: "TESTNET",
    isFreighterInstalled: true,
    isConnecting: false,
    isDetecting: false,
    error: null,
    isWrongNetwork: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
  };
}

function streamState(overrides: Partial<UseStreamResult> = {}): UseStreamResult {
  return {
    stream: makeStream(),
    isLoading: false,
    error: null,
    notConfigured: false,
    refetch: vi.fn(async () => {}),
    ...overrides,
  };
}

// Next 15 passes route params as a Promise. Marking it fulfilled lets React's
// `use()` read the value synchronously, so the page renders without Suspense.
function resolvedParams(id: string): Promise<{ id: string }> {
  const promise = Promise.resolve({ id }) as Promise<{ id: string }> & {
    status?: "fulfilled";
    value?: { id: string };
  };
  promise.status = "fulfilled";
  promise.value = { id };
  return promise;
}

function renderPage(id = "42") {
  return render(<StreamDetailPage params={resolvedParams(id)} />);
}

describe("StreamDetailLayout — invalid id", () => {
  beforeEach(() => {
    hooks.notFound.mockClear();
  });

  it("routes a non-numeric id to the not-found page before the client page mounts", async () => {
    await expect(
      StreamDetailLayout({ params: resolvedParams("abc"), children: <div>page</div> }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(hooks.notFound).toHaveBeenCalledTimes(1);
  });

  it("lets a numeric id through to the page", async () => {
    const children = <div>page</div>;
    await expect(StreamDetailLayout({ params: resolvedParams("42"), children })).resolves.toBe(children);
    expect(hooks.notFound).not.toHaveBeenCalled();
  });
});

describe("StreamDetailPage", () => {
  beforeEach(() => {
    hooks.useWallet.mockReset().mockReturnValue(walletAs(THIRD_PARTY));
    hooks.useStream.mockReset().mockReturnValue(streamState());
  });

  it("requests the stream for the route id", () => {
    renderPage("42");

    expect(hooks.useStream).toHaveBeenCalledWith("42");
  });

  it("shows a spinner and no content while the stream is loading", () => {
    hooks.useStream.mockReturnValue(streamState({ stream: null, isLoading: true }));

    renderPage();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back/ })).not.toBeInTheDocument();
  });

  it("shows the contracts-not-configured state", () => {
    hooks.useStream.mockReturnValue(streamState({ stream: null, notConfigured: true }));

    renderPage();

    expect(screen.getByRole("heading", { name: "Contracts not yet configured" })).toBeInTheDocument();
  });

  it("shows a not-found message when the stream does not exist", () => {
    hooks.useStream.mockReturnValue(streamState({ stream: null, error: null }));

    renderPage();

    expect(screen.getByText("Stream not found.")).toBeInTheDocument();
  });

  it("shows the error message and retries the load when the request fails", () => {
    const refetch = vi.fn(async () => {});
    hooks.useStream.mockReturnValue(streamState({ stream: null, error: "Indexer unavailable.", refetch }));

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Indexer unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the loaded stream with its amounts, parties and details", () => {
    renderPage();

    expect(screen.getByText("Stream #42")).toBeInTheDocument();
    expect(screen.getByTestId("live-balance")).toBeInTheDocument();
    expect(screen.getByText("Parties")).toBeInTheDocument();
    expect(screen.getByText("Stream details")).toBeInTheDocument();
    // 15000000 and 5000000 stroops (7 decimals) are formatted from BigInt, not floats.
    expect(screen.getByText("Total amount").nextElementSibling).toHaveTextContent("1.50 XLM");
    expect(screen.getByText("Withdrawn").nextElementSibling).toHaveTextContent("0.50 XLM");
    expect(screen.getByText("Cancellable").nextElementSibling).toHaveTextContent("Yes");
  });

  it("offers the sender a cancel action and a link back to Sending, but no withdraw", () => {
    hooks.useWallet.mockReturnValue(walletAs(SENDER));

    renderPage();

    expect(screen.getByRole("link", { name: "← Back to sending" })).toHaveAttribute("href", "/sending");
    expect(screen.getByRole("button", { name: "Cancel stream" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("offers the recipient a withdraw action and a link back to Receiving, but no cancel", () => {
    hooks.useWallet.mockReturnValue(walletAs(RECIPIENT));

    renderPage();

    expect(screen.getByRole("link", { name: "← Back to receiving" })).toHaveAttribute("href", "/receiving");
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
  });

  it("offers a third party neither action and links back home", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "← Back home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Connect your wallet to withdraw/)).not.toBeInTheDocument();
  });

  it("asks a disconnected visitor to connect, and offers no actions", () => {
    hooks.useWallet.mockReturnValue(walletAs(null));

    renderPage();

    expect(screen.getByText("Connect your wallet to withdraw or manage this stream.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
  });

  it("does not offer cancel to the sender of a completed stream", () => {
    hooks.useWallet.mockReturnValue(walletAs(SENDER));
    hooks.useStream.mockReturnValue(streamState({ stream: makeStream({ status: "completed", cancellable: true }) }));

    renderPage();

    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
  });
});
