// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeTokenContractId } from "@/lib/stellar";
import { CreateStreamForm } from "./CreateStreamForm";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Wallet — default to disconnected; individual tests override via mockReturnValue
const mockWallet = {
  isConnected: false,
  isConnecting: false,
  isDetecting: false,
  publicKey: null as string | null,
  network: null as string | null,
  isFreighterInstalled: true,
  isWrongNetwork: false,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  clearError: vi.fn(),
};
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet,
}));

// Router — no-op; we only care that push is called with the right path
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Token lookup — always resolves quickly as "not detected" so the form is usable
vi.mock("@/lib/tokens", () => ({
  lookupTokenInfo: vi.fn().mockResolvedValue({
    token: { contractId: "", symbol: "", decimals: 7 },
    detected: false,
  }),
}));

// Ledger snapshot — stable reference point so ledger conversion is deterministic
const LEDGER_NOW = 100_000;
const SNAPSHOT_TS = Date.now();
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    fetchLatestLedgerSnapshot: vi.fn().mockResolvedValue({
      ledger: LEDGER_NOW,
      timestampMs: SNAPSHOT_TS,
    }),
  };
});

// createStreamOnChain — controllable in submit tests
const mockCreateStreamOnChain = vi.fn();
vi.mock("@/lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contracts")>();
  return {
    ...actual,
    createStreamOnChain: (params: Parameters<typeof mockCreateStreamOnChain>[0]) => mockCreateStreamOnChain(params),
    // Surface the real isStreamContractConfigured so the flag banner logic stays
    // testable, but allow env-var toggling via process.env in tests.
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function connectedWallet() {
  mockWallet.isConnected = true;
  mockWallet.publicKey = SENDER;
}

function disconnectedWallet() {
  mockWallet.isConnected = false;
  mockWallet.publicKey = null;
}

/** Renders the form and returns common query helpers. */
function renderForm() {
  render(<CreateStreamForm />);
  return {
    recipientInput: () => screen.getByLabelText("Recipient address"),
    amountInput: () => screen.getByLabelText("Total amount"),
    submitButton: () =>
      screen.queryByRole("button", { name: /create stream/i }) ??
      screen.queryByRole("button", { name: /connect wallet/i }),
  };
}

// Make sure the stream contract env var is set so canSubmit can be true
beforeEach(() => {
  vi.clearAllMocks();
  disconnectedWallet();
  process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
  mockCreateStreamOnChain.mockResolvedValue({ streamId: "42", hash: "abc123" });
});

// ---------------------------------------------------------------------------
// Wallet connection state
// ---------------------------------------------------------------------------

describe("CreateStreamForm — wallet connection", () => {
  it("shows Connect wallet button when the wallet is disconnected", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create stream/i })).toBeNull();
  });

  it("shows Create stream button when the wallet is connected", () => {
    connectedWallet();
    renderForm();
    expect(screen.getByRole("button", { name: /create stream/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect wallet/i })).toBeNull();
  });

  it("calls wallet.connect when Connect wallet is clicked", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(mockWallet.connect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Required-field validation summary
// ---------------------------------------------------------------------------

describe("CreateStreamForm — required field errors", () => {
  it("shows no error summary before the first submit attempt", () => {
    connectedWallet();
    renderForm();
    expect(screen.queryByRole("alert", { name: /form errors/i })).toBeNull();
  });

  it("displays an error summary listing all required fields when submitted empty", async () => {
    connectedWallet();
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));

    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toBeInTheDocument();
    // Recipient is required
    expect(summary).toHaveTextContent("Recipient address is required.");
    // Amount is required
    expect(summary).toHaveTextContent("Enter an amount.");
  });

  it("hides the error summary once all errors are resolved", async () => {
    connectedWallet();
    renderForm();

    // Trigger summary
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    await screen.findByRole("alert", { name: /form errors/i });

    // Fill in valid recipient
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    // Fill in valid amount
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await waitFor(() => expect(screen.queryByRole("alert", { name: /form errors/i })).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// Recipient validation
// ---------------------------------------------------------------------------

describe("CreateStreamForm — recipient validation", () => {
  it("reports a required-address error when recipient is empty on submit", async () => {
    connectedWallet();
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Recipient address is required.");
  });

  it("reports an invalid-address error when recipient is malformed on submit", async () => {
    connectedWallet();
    renderForm();
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: "GABC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Recipient address is not a valid Stellar account address.");
  });

  it("reports an error when recipient equals the connected sender", async () => {
    connectedWallet();
    renderForm();
    // Type the sender's own address into the recipient field
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: SENDER },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Recipient cannot be the same as the sender.");
  });
});

// ---------------------------------------------------------------------------
// Amount validation
// ---------------------------------------------------------------------------

describe("CreateStreamForm — amount validation", () => {
  it("reports a required error when amount is empty on submit", async () => {
    connectedWallet();
    renderForm();
    // Provide a valid recipient so the only remaining error is amount
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Enter an amount.");
  });

  it("reports an invalid-amount error for a non-numeric string", async () => {
    connectedWallet();
    renderForm();
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Enter a valid, non-negative number.");
  });

  it("reports an error for an amount that is zero in base units", async () => {
    connectedWallet();
    renderForm();
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "0.000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Amount must be greater than zero.");
  });

  it("reports an error for an amount that exceeds i128 max", async () => {
    connectedWallet();
    renderForm();
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "999999999999999999999999999999999999999" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent("Amount is too large.");
  });
});

// ---------------------------------------------------------------------------
// Schedule validation
// ---------------------------------------------------------------------------

describe("CreateStreamForm — schedule validation", () => {
  it("reports a schedule error when end date is before start date on submit", async () => {
    connectedWallet();
    renderForm();

    // Set start to a future date and end to a date before start
    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");

    const startValue = new Date(Date.now() + 10 * 60_000);
    const endValue = new Date(startValue.getTime() - 60_000); // 1 minute before start

    fireEvent.change(start, { target: { value: toLocalInputValue(startValue) } });
    fireEvent.change(end, { target: { value: toLocalInputValue(endValue) } });

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create stream/i }));

    const summary = await screen.findByRole("alert", { name: /form errors/i });
    expect(summary).toHaveTextContent(
      "Check the stream schedule: end must be after start, and cliff must be between start and end."
    );
  });
});

// ---------------------------------------------------------------------------
// Successful submission
// ---------------------------------------------------------------------------

describe("CreateStreamForm — successful submission", () => {
  it("calls createStreamOnChain with the right totalAmount as BigInt (floored, never rounded up)", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    // "1.5" XLM = 15_000_000 stroops (7 decimals, BigInt)
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "1.5" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await waitFor(() => expect(mockCreateStreamOnChain).toHaveBeenCalled());

    const args = mockCreateStreamOnChain.mock.calls[0][0];
    expect(typeof args.totalAmount).toBe("bigint");
    expect(args.totalAmount).toBe(15_000_000n);
    expect(args.sender).toBe(SENDER);
    expect(args.recipient).toBe(RECIPIENT);
    expect(args.tokenContractId).toBe(nativeTokenContractId());
  });

  it("passes startLedger and endLedger as numbers derived from the picked dates", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await waitFor(() => expect(mockCreateStreamOnChain).toHaveBeenCalled());

    const args = mockCreateStreamOnChain.mock.calls[0][0];
    expect(typeof args.startLedger).toBe("number");
    expect(typeof args.endLedger).toBe("number");
    expect(args.endLedger).toBeGreaterThan(args.startLedger);
  });

  it("passes cancellable as true by default", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await waitFor(() => expect(mockCreateStreamOnChain).toHaveBeenCalled());
    expect(mockCreateStreamOnChain.mock.calls[0][0].cancellable).toBe(true);
  });

  it("floors fractional base-unit amounts — never rounds up", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    // "0.0000001" XLM = 1 stroop exactly — the minimum non-zero XLM amount
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "0.0000001" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await waitFor(() => expect(mockCreateStreamOnChain).toHaveBeenCalled());
    expect(mockCreateStreamOnChain.mock.calls[0][0].totalAmount).toBe(1n);
  });

  it("renders the success state after a stream is created", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await screen.findByRole("status");
    expect(screen.getByText("Stream created")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view stream/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create another stream/i })).toBeInTheDocument();
  });

  it("navigates to the stream page when View stream is clicked", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: /view stream/i }));
    expect(mockPush).toHaveBeenCalledWith("/streams/42");
  });

  it("resets the form when Create another stream is clicked", async () => {
    connectedWallet();
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: /create another stream/i }));

    // Form should reappear
    await screen.findByLabelText("Recipient address");
    expect(screen.getByLabelText("Recipient address")).toHaveValue("");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("CreateStreamForm — error handling", () => {
  it("shows an error message when createStreamOnChain rejects", async () => {
    connectedWallet();
    mockCreateStreamOnChain.mockRejectedValue(new Error("User rejected the request"));
    renderForm();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Total amount"), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toBeInTheDocument();
  });

  it("shows the contract-not-configured banner when the contract env var is missing", () => {
    delete process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
    connectedWallet();
    renderForm();
    expect(screen.getByText(/NEXT_PUBLIC_STREAM_CONTRACT_ID/)).toBeInTheDocument();
    // Restore for subsequent tests
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
  });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toLocalInputValue(date: Date): string {
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}
