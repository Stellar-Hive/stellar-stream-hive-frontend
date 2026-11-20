import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Stream, WalletState } from "@/types";
import type { UseStreamsResult } from "@/hooks/useStreams";

const hooks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  useStreams: vi.fn<(address: string | null, role: string) => UseStreamsResult>(),
}));

const contracts = vi.hoisted(() => ({
  fetchWithdrawableOnChain: vi.fn<(streamId: string) => Promise<bigint>>(),
  withdrawOnChain: vi.fn<(params: { streamId: string; recipient: string; amount: bigint }) => Promise<{ hash: string }>>(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: hooks.useWallet }));
vi.mock("@/hooks/useStreams", () => ({ useStreams: hooks.useStreams }));

vi.mock("@/lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contracts")>();
  return {
    ...actual,
    fetchWithdrawableOnChain: contracts.fetchWithdrawableOnChain,
    withdrawOnChain: contracts.withdrawOnChain,
  };
});

// The live total and the cards tick off the ledger RPC; keep this suite offline.
vi.mock("@/components/stream/TotalWithdrawable", () => ({ TotalWithdrawable: () => null }));
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

import ReceivingPage from "./page";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function makeStream(id: string, status: Stream["status"]): Stream {
  return {
    id,
    sender: SENDER,
    recipient: RECIPIENT,
    token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
    totalAmount: "50000000",
    withdrawnAmount: "0",
    startLedger: 100,
    endLedger: 2_000,
    startTime: 0,
    endTime: 0,
    cancellable: false,
    status,
  };
}

function connectedWallet(): WalletState & Record<string, unknown> {
  return {
    isConnected: true,
    publicKey: RECIPIENT,
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

function streamsState(streams: Stream[], refetch = vi.fn(async () => {})): UseStreamsResult {
  return { streams, isLoading: false, error: null, apiConfigured: true, refetch };
}

// Withdrawable amounts per stream. Stream "4" is scheduled and must never be checked.
const WITHDRAWABLE: Record<string, bigint> = { "1": 5n, "2": 3n, "3": 2n, "5": 0n };

const STREAMS = [
  makeStream("1", "active"),
  makeStream("2", "completed"),
  makeStream("3", "cancelled"),
  makeStream("4", "scheduled"),
  makeStream("5", "cancelled"),
];

describe("ReceivingPage — Withdraw All", () => {
  beforeEach(() => {
    hooks.useWallet.mockReset().mockReturnValue(connectedWallet());
    contracts.fetchWithdrawableOnChain.mockReset().mockImplementation(async (id) => WITHDRAWABLE[id] ?? 0n);
    contracts.withdrawOnChain.mockReset();
  });

  it("includes completed and cancelled streams that still hold funds, but not scheduled ones", async () => {
    hooks.useStreams.mockReturnValue(streamsState(STREAMS));
    contracts.withdrawOnChain.mockImplementation(async ({ streamId }) => ({ hash: `hash-${streamId}` }));

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (4)" }));

    await waitFor(() => expect(screen.getByText(/Withdraw All results/)).toBeInTheDocument());

    expect(contracts.fetchWithdrawableOnChain.mock.calls.map(([id]) => id)).toEqual(["1", "2", "3", "5"]);
    expect(contracts.fetchWithdrawableOnChain).not.toHaveBeenCalledWith("4");

    // Stream "5" has nothing left to withdraw, so no transaction is sent for it.
    expect(contracts.withdrawOnChain).toHaveBeenCalledTimes(3);
    expect(contracts.withdrawOnChain.mock.calls.map(([params]) => params.streamId)).toEqual(["1", "2", "3"]);
  });

  it("withdraws the exact on-chain amount for each stream, as BigInt, to the connected recipient", async () => {
    hooks.useStreams.mockReturnValue(streamsState(STREAMS));
    contracts.withdrawOnChain.mockImplementation(async ({ streamId }) => ({ hash: `hash-${streamId}` }));

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (4)" }));

    await waitFor(() => expect(contracts.withdrawOnChain).toHaveBeenCalledTimes(3));
    expect(contracts.withdrawOnChain).toHaveBeenNthCalledWith(1, { streamId: "1", recipient: RECIPIENT, amount: 5n });
    expect(contracts.withdrawOnChain).toHaveBeenNthCalledWith(2, { streamId: "2", recipient: RECIPIENT, amount: 3n });
    expect(contracts.withdrawOnChain).toHaveBeenNthCalledWith(3, { streamId: "3", recipient: RECIPIENT, amount: 2n });
    for (const [params] of contracts.withdrawOnChain.mock.calls) {
      expect(typeof params.amount).toBe("bigint");
    }
  });

  it("keeps going after one stream fails and reports each stream's outcome", async () => {
    hooks.useStreams.mockReturnValue(streamsState(STREAMS));
    contracts.withdrawOnChain.mockImplementation(async ({ streamId }) => {
      if (streamId === "2") throw new Error("network timeout");
      return { hash: `hash-${streamId}` };
    });

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (4)" }));

    expect(await screen.findByText("Withdraw All results (2 succeeded, 1 failed)")).toBeInTheDocument();

    // Stream "3" was still attempted after "2" failed.
    expect(contracts.withdrawOnChain.mock.calls.map(([params]) => params.streamId)).toEqual(["1", "2", "3"]);

    const results = screen.getByText("Withdraw All results (2 succeeded, 1 failed)").parentElement!;
    const rows = within(results).getAllByRole("listitem");
    expect(rows).toHaveLength(3);

    const [first, failed, third] = rows;
    expect(within(first).getByText("Stream #1")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "View transaction" })).toHaveAttribute(
      "href",
      expect.stringContaining("hash-1"),
    );
    expect(within(failed).getByText("Stream #2")).toBeInTheDocument();
    expect(within(failed).getByText("network timeout")).toBeInTheDocument();
    expect(within(third).getByRole("link", { name: "View transaction" })).toHaveAttribute(
      "href",
      expect.stringContaining("hash-3"),
    );
  });

  it("refreshes the stream list once the run finishes", async () => {
    const refetch = vi.fn(async () => {});
    hooks.useStreams.mockReturnValue(streamsState(STREAMS, refetch));
    contracts.withdrawOnChain.mockResolvedValue({ hash: "hash" });

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (4)" }));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it("disables the button and shows progress while withdrawals are running", async () => {
    hooks.useStreams.mockReturnValue(streamsState(STREAMS));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    contracts.withdrawOnChain.mockImplementation(async ({ streamId }) => {
      await gate;
      return { hash: `hash-${streamId}` };
    });

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (4)" }));

    const running = await screen.findByRole("button", { name: /Withdrawing/ });
    expect(running).toBeDisabled();

    release();
    expect(await screen.findByRole("button", { name: "Withdraw All (4)" })).toBeEnabled();
  });

  it("reports that nothing was withdrawable when every stream is empty", async () => {
    hooks.useStreams.mockReturnValue(streamsState([makeStream("5", "cancelled")]));

    render(<ReceivingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw All (1)" }));

    expect(await screen.findByText("Nothing was withdrawable.")).toBeInTheDocument();
    expect(contracts.withdrawOnChain).not.toHaveBeenCalled();
  });

  it("does not offer Withdraw All when there is nothing to withdraw from", () => {
    hooks.useStreams.mockReturnValue(streamsState([makeStream("4", "scheduled")]));

    render(<ReceivingPage />);

    expect(screen.queryByRole("button", { name: /Withdraw All/ })).not.toBeInTheDocument();
  });
});
