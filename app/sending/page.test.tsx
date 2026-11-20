import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Stream, WalletState } from "@/types";
import type { UseStreamsResult } from "@/hooks/useStreams";

const hooks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  useStreams: vi.fn<(address: string | null, role: string) => UseStreamsResult>(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: hooks.useWallet }));
vi.mock("@/hooks/useStreams", () => ({ useStreams: hooks.useStreams }));

// The ledger RPC is only reached for live streams; keep the list state offline.
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    fetchLatestLedgerSnapshot: vi.fn(async () => ({ ledger: 1_000, timestampMs: Date.now() })),
  };
});

vi.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

import SendingPage from "./page";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: "1",
    sender: SENDER,
    recipient: RECIPIENT,
    token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
    totalAmount: "15000000",
    withdrawnAmount: "0",
    startLedger: 100,
    endLedger: 2_000,
    startTime: 0,
    endTime: 0,
    cancellable: true,
    status: "active",
    ...overrides,
  };
}

function connected(publicKey: string | null = SENDER): WalletState & Record<string, unknown> {
  return {
    isConnected: true,
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

function disconnected() {
  return { ...connected(null), isConnected: false, publicKey: null };
}

function streamsState(overrides: Partial<UseStreamsResult> = {}): UseStreamsResult {
  return {
    streams: [],
    isLoading: false,
    error: null,
    apiConfigured: true,
    refetch: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("SendingPage", () => {
  beforeEach(() => {
    hooks.useWallet.mockReset().mockReturnValue(connected());
    hooks.useStreams.mockReset().mockReturnValue(streamsState());
  });

  it("shows the connect prompt and no list when no wallet is connected", () => {
    hooks.useWallet.mockReturnValue(disconnected());

    render(<SendingPage />);

    expect(screen.getByRole("heading", { name: "Streams you're sending" })).toBeInTheDocument();
    expect(screen.getByText("Connect your wallet to see the streams you've created.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.queryByText("Total outgoing commitment")).not.toBeInTheDocument();
    // Streams are only requested once a wallet is connected.
    expect(hooks.useStreams).toHaveBeenCalledWith(null, "sender");
  });

  it("warns that the list may be incomplete when the indexer API is not configured", () => {
    hooks.useStreams.mockReturnValue(streamsState({ apiConfigured: false, streams: [makeStream()] }));

    render(<SendingPage />);

    expect(screen.getByText(/indexer api isn't configured yet, so this list may be incomplete/i)).toBeInTheDocument();
  });

  it("shows a loading state while streams are being fetched", () => {
    hooks.useStreams.mockReturnValue(streamsState({ isLoading: true }));

    const { container } = render(<SendingPage />);

    const commitment = container.querySelector('[aria-busy="true"]');
    expect(commitment).not.toBeNull();
    expect(within(commitment as HTMLElement).getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("No outgoing streams yet")).not.toBeInTheDocument();
  });

  it("shows the error message with a retry, and marks the commitment as unavailable", () => {
    const refetch = vi.fn(async () => {});
    hooks.useStreams.mockReturnValue(streamsState({ error: "Indexer request failed.", refetch }));

    render(<SendingPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Indexer request failed.");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state with a create link when the sender has no streams", () => {
    render(<SendingPage />);

    expect(screen.getByRole("heading", { name: "No outgoing streams yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a stream" })).toHaveAttribute("href", "/streams/new");
    expect(screen.getByText("No live streams")).toBeInTheDocument();
  });

  it("renders a card for each stream when the sender has streams", () => {
    hooks.useStreams.mockReturnValue(
      streamsState({
        streams: [makeStream({ id: "7" }), makeStream({ id: "8", status: "completed", cancellable: false })],
      }),
    );

    render(<SendingPage />);

    const detailLinks = screen.getAllByRole("link", { name: "View details →" });
    expect(detailLinks.map((link) => link.getAttribute("href"))).toEqual(["/streams/7", "/streams/8"]);
    expect(screen.queryByRole("heading", { name: "No outgoing streams yet" })).not.toBeInTheDocument();
  });

  it("does not offer a CSV export when there are no streams", () => {
    render(<SendingPage />);

    expect(screen.queryByRole("button", { name: "Download CSV" })).not.toBeInTheDocument();
  });

  it("disables the CSV export when the current filter leaves nothing to export", () => {
    hooks.useStreams.mockReturnValue(streamsState({ streams: [makeStream({ id: "9", status: "active" })] }));

    render(<SendingPage />);

    const exportButton = screen.getByRole("button", { name: "Download CSV" });
    expect(exportButton).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /^Cancelled/ }));

    expect(screen.getByText("No matching streams")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  });
});
