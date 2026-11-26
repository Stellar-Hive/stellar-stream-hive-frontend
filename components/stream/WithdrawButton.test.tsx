// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WithdrawButton } from "./WithdrawButton";

// The component re-fetches the real withdrawable amount from the contract at
// submit time; both contract calls are mocked so tests never touch the network.
const fetchWithdrawableOnChain = vi.fn<(streamId: string) => Promise<bigint>>();
const withdrawOnChain = vi.fn<(args: { streamId: string; recipient: string; amount: bigint }) => Promise<{ hash: string }>>();

vi.mock("@/lib/contracts", () => ({
  fetchWithdrawableOnChain: (streamId: string) => fetchWithdrawableOnChain(streamId),
  withdrawOnChain: (args: { streamId: string; recipient: string; amount: bigint }) => withdrawOnChain(args),
  ContractNotConfiguredError: class ContractNotConfiguredError extends Error {},
}));

const STREAM_ID = "42";
const RECIPIENT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function renderButton(overrides: Partial<Parameters<typeof WithdrawButton>[0]> = {}) {
  const onWithdrawn = vi.fn();
  render(
    <WithdrawButton
      streamId={STREAM_ID}
      recipientAddress={RECIPIENT}
      connectedAddress={RECIPIENT}
      tokenSymbol="XLM"
      tokenDecimals={7}
      onWithdrawn={onWithdrawn}
      {...overrides}
    />
  );
  return { onWithdrawn };
}

/** Opens the panel and switches to the custom-amount mode. */
function openCustomMode() {
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  fireEvent.click(screen.getByRole("button", { name: "Custom amount" }));
}

function amountField() {
  return screen.getByPlaceholderText("Amount in XLM");
}

beforeEach(() => {
  fetchWithdrawableOnChain.mockReset();
  withdrawOnChain.mockReset();
});

describe("WithdrawButton", () => {
  it("renders nothing when the connected wallet is not the recipient", () => {
    renderButton({ connectedAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" });
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("Max mode sends the re-fetched on-chain amount, not a client estimate", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(12_345_678n);
    withdrawOnChain.mockResolvedValue({ hash: "abc123" });
    const { onWithdrawn } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    await waitFor(() => expect(withdrawOnChain).toHaveBeenCalledTimes(1));
    expect(fetchWithdrawableOnChain).toHaveBeenCalledWith(STREAM_ID);
    expect(withdrawOnChain).toHaveBeenCalledWith({
      streamId: STREAM_ID,
      recipient: RECIPIENT,
      amount: 12_345_678n,
    });
    expect(onWithdrawn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Withdrawal submitted")).toBeInTheDocument();
  });

  it("Max mode shows an error and sends nothing when nothing is withdrawable", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(0n);
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing is withdrawable yet.");
    expect(withdrawOnChain).not.toHaveBeenCalled();
  });

  it("custom amounts over the on-chain limit show an error and send nothing", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(5_000_000n);
    renderButton();
    openCustomMode();

    fireEvent.change(amountField(), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Requested amount exceeds what's currently withdrawable on-chain");
    expect(alert).toHaveTextContent("0.50 XLM");
    expect(withdrawOnChain).not.toHaveBeenCalled();
  });

  it("custom amounts within the limit are sent as exact BigInt base units", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(5_000_000n);
    withdrawOnChain.mockResolvedValue({ hash: "def456" });
    renderButton();
    openCustomMode();

    fireEvent.change(amountField(), { target: { value: "0.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    await waitFor(() => expect(withdrawOnChain).toHaveBeenCalledTimes(1));
    expect(withdrawOnChain).toHaveBeenCalledWith({
      streamId: STREAM_ID,
      recipient: RECIPIENT,
      amount: 2_500_000n,
    });
  });

  it("rejects custom amounts with more decimals than the token supports", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(5_000_000n);
    renderButton();
    openCustomMode();

    fireEvent.change(amountField(), { target: { value: "0.12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This token supports at most 7 decimal places."
    );
    expect(withdrawOnChain).not.toHaveBeenCalled();
  });

  it("shows the mapped contract message when the withdrawal fails", async () => {
    fetchWithdrawableOnChain.mockResolvedValue(5_000_000n);
    withdrawOnChain.mockRejectedValue(new Error("HostError: Error(Contract, #8)"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That withdrawal isn't available yet.");
    expect(screen.queryByText("Withdrawal submitted")).not.toBeInTheDocument();
  });
});
