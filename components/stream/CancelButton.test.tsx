// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stream } from "@/types";
import { CancelButton } from "./CancelButton";

// Both contract reads and the cancel call are mocked so tests never touch the
// network; the split itself is computed by the real lib/streaming helpers.
const fetchStreamOnChain = vi.fn<(streamId: string) => Promise<Stream | null>>();
const cancelStreamOnChain = vi.fn<(args: { streamId: string; sender: string }) => Promise<{ hash: string }>>();
const fetchLatestLedgerSnapshot = vi.fn<() => Promise<{ ledger: number; timestampMs: number }>>();

vi.mock("@/lib/contracts", () => ({
  fetchStreamOnChain: (streamId: string) => fetchStreamOnChain(streamId),
  cancelStreamOnChain: (args: { streamId: string; sender: string }) => cancelStreamOnChain(args),
  ContractNotConfiguredError: class ContractNotConfiguredError extends Error {},
  TransactionTimeoutError: class TransactionTimeoutError extends Error {
    hash: string;
    constructor(hash: string) {
      super("timed out");
      this.hash = hash;
    }
  },
}));

vi.mock("@/lib/stellar", () => ({
  fetchLatestLedgerSnapshot: () => fetchLatestLedgerSnapshot(),
  STELLAR_EXPERT_NETWORK: "testnet",
}));

const STREAM_ID = "42";
const SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** 100 XLM total, streaming from ledger 100 to 200. */
const baseStream: Stream = {
  id: STREAM_ID,
  sender: SENDER,
  recipient: RECIPIENT,
  token: { contractId: "xlm", symbol: "XLM", decimals: 7 },
  totalAmount: "1000000000",
  withdrawnAmount: "0",
  startLedger: 100,
  endLedger: 200,
  startTime: 0,
  endTime: 0,
  status: "active",
  cancellable: true,
};

function renderButton(overrides: Partial<Parameters<typeof CancelButton>[0]> = {}) {
  const onCancelled = vi.fn();
  render(
    <CancelButton
      streamId={STREAM_ID}
      senderAddress={SENDER}
      connectedAddress={SENDER}
      cancellable
      tokenSymbol="XLM"
      tokenDecimals={7}
      onCancelled={onCancelled}
      {...overrides}
    />
  );
  return { onCancelled };
}

/** Opens the dialog and waits for the on-chain split to be computed. */
async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Cancel stream" }));
  await screen.findByText("Recipient receives");
}

function splitValues() {
  const rows = screen.getAllByText(/Recipient receives|Sender refunded/);
  return rows.map((row) => row.parentElement?.textContent ?? "");
}

beforeEach(() => {
  fetchStreamOnChain.mockReset();
  cancelStreamOnChain.mockReset();
  fetchLatestLedgerSnapshot.mockReset();
  fetchLatestLedgerSnapshot.mockResolvedValue({ ledger: 150, timestampMs: 0 });
});

describe("CancelButton", () => {
  it("renders nothing when the connected wallet is not the sender", () => {
    renderButton({ connectedAddress: RECIPIENT });
    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
  });

  it("renders nothing when the stream is not cancellable", () => {
    renderButton({ cancellable: false });
    expect(screen.queryByRole("button", { name: "Cancel stream" })).not.toBeInTheDocument();
  });

  it("refunds the sender in full before the cliff", async () => {
    fetchStreamOnChain.mockResolvedValue({ ...baseStream, cliffLedger: 160 });
    renderButton();
    await openDialog();

    expect(fetchStreamOnChain).toHaveBeenCalledWith(STREAM_ID);
    expect(splitValues()).toEqual(["Recipient receives0.00 XLM", "Sender refunded100.00 XLM"]);
  });

  it("splits mid-stream, flooring the recipient share", async () => {
    // 1/3 of the way through: 333_333_333.33… stroops streamed, floored.
    fetchLatestLedgerSnapshot.mockResolvedValue({ ledger: 133, timestampMs: 0 });
    fetchStreamOnChain.mockResolvedValue({ ...baseStream, withdrawnAmount: "100000000" });
    renderButton();
    await openDialog();

    expect(splitValues()).toEqual(["Recipient receives33.33 XLM", "Sender refunded66.66 XLM"]);
  });

  it("pays the recipient everything once the stream has ended", async () => {
    fetchLatestLedgerSnapshot.mockResolvedValue({ ledger: 250, timestampMs: 0 });
    fetchStreamOnChain.mockResolvedValue(baseStream);
    renderButton();
    await openDialog();

    expect(splitValues()).toEqual(["Recipient receives100.00 XLM", "Sender refunded0.00 XLM"]);
  });

  it("shows an error state when the stream is not found on-chain", async () => {
    fetchStreamOnChain.mockResolvedValue(null);
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Cancel stream" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Stream not found on-chain.");
    expect(screen.queryByText("Recipient receives")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, cancel stream" })).toBeDisabled();
  });

  it("closes on Escape without calling the contract", async () => {
    fetchStreamOnChain.mockResolvedValue(baseStream);
    renderButton();
    await openDialog();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cancelStreamOnChain).not.toHaveBeenCalled();
  });

  it("closes on Keep streaming without calling the contract", async () => {
    fetchStreamOnChain.mockResolvedValue(baseStream);
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Keep streaming" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cancelStreamOnChain).not.toHaveBeenCalled();
  });

  it("calls the contract helper exactly once on Confirm", async () => {
    fetchStreamOnChain.mockResolvedValue(baseStream);
    cancelStreamOnChain.mockResolvedValue({ hash: "abc123" });
    const { onCancelled } = renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel stream" }));

    await waitFor(() => expect(cancelStreamOnChain).toHaveBeenCalledTimes(1));
    expect(cancelStreamOnChain).toHaveBeenCalledWith({ streamId: STREAM_ID, sender: SENDER });
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Stream cancelled.")).toBeInTheDocument();
  });
});
