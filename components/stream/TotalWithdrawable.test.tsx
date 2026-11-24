import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Stream } from "@/types";
import { TotalWithdrawable } from "./TotalWithdrawable";

vi.mock("@/hooks/useLedgerSnapshot", () => ({
  useLedgerSnapshot: () => ({
    snapshot: { ledger: 150, timestampMs: Date.now() },
    isLoading: false,
  }),
}));

const stream: Stream = {
  id: "1",
  sender: "sender",
  recipient: "recipient",
  token: { contractId: "xlm", symbol: "XLM", decimals: 7 },
  totalAmount: "20001999",
  withdrawnAmount: "0",
  startLedger: 100,
  endLedger: 200,
  startTime: 0,
  endTime: 0,
  status: "active",
  cancellable: true,
};

describe("TotalWithdrawable", () => {
  it("sums the same token before flooring the displayed amount", () => {
    render(<TotalWithdrawable streams={[stream, { ...stream, id: "2" }]} />);
    expect(screen.getByText("2.0001 XLM")).toBeInTheDocument();
  });

  it("displays separate totals for different tokens", () => {
    const usdc = { contractId: "usdc", symbol: "USDC", decimals: 6 };
    render(<TotalWithdrawable streams={[stream, { ...stream, id: "2", token: usdc }]} />);
    expect(screen.getByText("1.00 XLM")).toBeInTheDocument();
    expect(screen.getByText("10.0009 USDC")).toBeInTheDocument();
  });

  it("renders no total for an empty list", () => {
    const { container } = render(<TotalWithdrawable streams={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses only the indexed frozen remainder for a cancelled stream", () => {
    render(<TotalWithdrawable streams={[{ ...stream, status: "cancelled", frozenWithdrawableAmount: "3123999" }]} />);
    expect(screen.getByText("0.3123 XLM")).toBeInTheDocument();
  });

  it("reports a missing frozen remainder without showing a partial total", () => {
    render(<TotalWithdrawable streams={[stream, { ...stream, id: "2", status: "cancelled" }]} />);
    expect(screen.getByText("XLM total unavailable")).toBeInTheDocument();
  });
});
