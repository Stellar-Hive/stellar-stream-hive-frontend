// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeTokenContractId } from "@/lib/stellar";
import type { TokenInfo } from "@/types";
import { AmountInput, type AmountInputProps } from "./AmountInput";

// The component reads token symbol/decimals over Soroban RPC; the lookup is
// mocked so tests never touch the network and control the detected outcome.
const lookupTokenInfo = vi.fn<(contractId: string) => Promise<{ token: TokenInfo; detected: boolean }>>();

vi.mock("@/lib/tokens", () => ({
  lookupTokenInfo: (contractId: string) => lookupTokenInfo(contractId),
}));

const XLM: TokenInfo = { contractId: nativeTokenContractId(), symbol: "XLM", decimals: 7 };
/** What the component emits when the user picks "Custom token" in the selector. */
const CUSTOM: TokenInfo = { contractId: "", symbol: "", decimals: 7 };
/** A StrKey-valid contract address, so the component actually fires the lookup. */
const VALID_CONTRACT = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

function renderInput(overrides: Partial<AmountInputProps> = {}) {
  const props: AmountInputProps = {
    amount: "",
    onAmountChange: vi.fn(),
    token: XLM,
    onTokenChange: vi.fn(),
    ...overrides,
  };
  render(<AmountInput {...props} />);
  return { props };
}

/** Controlled wrapper so the component's change callbacks actually update the rendered token. */
function Controlled(props: Pick<Partial<AmountInputProps>, "onLookupChange"> & { token?: TokenInfo; amount?: string }) {
  const [amount, setAmount] = useState(props.amount ?? "");
  const [token, setToken] = useState(props.token ?? XLM);
  return (
    <AmountInput
      amount={amount}
      onAmountChange={setAmount}
      token={token}
      onTokenChange={setToken}
      onLookupChange={props.onLookupChange}
    />
  );
}

const amountField = () => screen.getByLabelText("Total amount");
const tokenSelect = () => screen.getByLabelText("Token");
const contractField = () => screen.getByLabelText("Token contract ID");
const decimalsField = () => screen.getByLabelText("Decimals");

describe("AmountInput — amount validation", () => {
  it("shows no error while the amount is empty", () => {
    renderInput({ amount: "" });
    expect(amountField()).toHaveAttribute("aria-invalid", "false");
    expect(document.getElementById("amount-error")).toBeNull();
  });

  it("rejects malformed input", () => {
    renderInput({ amount: "abc" });
    expect(screen.getByText("Enter a valid, non-negative number.")).toBeInTheDocument();
    expect(amountField()).toHaveAttribute("aria-invalid", "true");
    expect(amountField()).toHaveAttribute("aria-describedby", "amount-error");
  });

  it("rejects more fractional digits than the token supports", () => {
    renderInput({ amount: "1.00000001" }); // 8 fractional digits for a 7-decimal token
    expect(screen.getByText("This token supports at most 7 decimal places.")).toBeInTheDocument();
  });

  it("rejects fractional input for a 0-decimal token", () => {
    renderInput({ amount: "1.5", token: { contractId: "x", symbol: "", decimals: 0 } });
    expect(screen.getByText("This token has no decimal places; enter a whole number.")).toBeInTheDocument();
  });

  it("rejects amounts that are zero in base units", () => {
    renderInput({ amount: "0.000" });
    expect(screen.getByText("Amount must be greater than zero.")).toBeInTheDocument();
  });

  it("rejects amounts beyond the i128 range", () => {
    renderInput({ amount: "999999999999999999999999999999999999999" });
    expect(screen.getByText("Amount is too large.")).toBeInTheDocument();
  });

  it("rejects a token whose decimals are not a valid integer", () => {
    renderInput({ amount: "1", token: { contractId: "x", symbol: "", decimals: 1.5 } });
    expect(screen.getByText("This token's decimal places are invalid.")).toBeInTheDocument();
  });

  it("shows no error for a valid amount", () => {
    renderInput({ amount: "12.5" });
    expect(document.getElementById("amount-error")).toBeNull();
    expect(amountField()).toHaveAttribute("aria-invalid", "false");
  });

  it("passes typed text through to onAmountChange", () => {
    const onAmountChange = vi.fn();
    renderInput({ onAmountChange });
    fireEvent.change(amountField(), { target: { value: "42.5" } });
    expect(onAmountChange).toHaveBeenCalledWith("42.5");
  });
});

describe("AmountInput — token selection", () => {
  it("reports the blank custom token when switching to Custom token", () => {
    const onTokenChange = vi.fn();
    renderInput({ onTokenChange });
    fireEvent.change(tokenSelect(), { target: { value: "custom" } });
    expect(onTokenChange).toHaveBeenCalledWith(CUSTOM);
  });

  it("reports the XLM token when switching back", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(tokenSelect(), { target: { value: "xlm" } });
    expect(onTokenChange).toHaveBeenCalledWith(XLM);
  });

  it("shows the custom-token fields only for a custom token", () => {
    render(<Controlled />);
    expect(screen.queryByLabelText("Token contract ID")).toBeNull();

    fireEvent.change(tokenSelect(), { target: { value: "custom" } });
    expect(screen.getByLabelText("Token contract ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByLabelText("Decimals")).toBeInTheDocument();

    fireEvent.change(tokenSelect(), { target: { value: "xlm" } });
    expect(screen.queryByLabelText("Token contract ID")).toBeNull();
  });

  it("flags a malformed contract ID", () => {
    renderInput({ token: { contractId: "not-a-contract", symbol: "", decimals: 7 } });
    expect(screen.getByText("Enter a valid Stellar contract ID.")).toBeInTheDocument();
    expect(contractField()).toHaveAttribute("aria-invalid", "true");
  });

  it("trims the contract ID before reporting it", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(contractField(), { target: { value: "  abc  " } });
    expect(onTokenChange).toHaveBeenCalledWith({ ...CUSTOM, contractId: "abc" });
  });

  it("uppercases and truncates the symbol at 12 characters", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(screen.getByLabelText("Symbol"), { target: { value: "abcdefghijklmnop" } });
    expect(onTokenChange).toHaveBeenCalledWith({ ...CUSTOM, symbol: "ABCDEFGHIJKL" });
  });
});

describe("AmountInput — custom-token decimals field", () => {
  it("shows the token's decimals and bounds the input to 0-18", () => {
    renderInput({ token: CUSTOM });
    const field = decimalsField();
    expect(field).toHaveValue(7);
    expect(field).toHaveAttribute("min", "0");
    expect(field).toHaveAttribute("max", "18");
    expect(field).toHaveAttribute("step", "1");
  });

  it("floors a fractional value instead of rounding", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(decimalsField(), { target: { value: "2.9" } });
    expect(onTokenChange).toHaveBeenCalledWith({ ...CUSTOM, decimals: 2 });
  });

  it("clamps an out-of-range value to 18", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(decimalsField(), { target: { value: "25" } });
    expect(onTokenChange).toHaveBeenCalledWith({ ...CUSTOM, decimals: 18 });
  });

  it("clamps a negative value to 0", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(decimalsField(), { target: { value: "-3" } });
    expect(onTokenChange).toHaveBeenCalledWith({ ...CUSTOM, decimals: 0 });
  });

  it("does not report a change while the field is empty", () => {
    const onTokenChange = vi.fn();
    renderInput({ token: CUSTOM, onTokenChange });
    fireEvent.change(decimalsField(), { target: { value: "" } });
    expect(onTokenChange).not.toHaveBeenCalled();
  });

  it("restores the stored decimals on blur when the parent did not accept the edit", () => {
    renderInput({ token: CUSTOM });
    const field = decimalsField();
    fireEvent.change(field, { target: { value: "2.9" } });
    expect(field).toHaveValue(2.9);
    fireEvent.blur(field);
    expect(field).toHaveValue(7);
  });

  it("resyncs the field to the decimals the parent stored", async () => {
    render(<Controlled token={CUSTOM} />);
    const field = decimalsField();
    fireEvent.change(field, { target: { value: "2.9" } });
    await waitFor(() => expect(field).toHaveValue(2));
  });
});

describe("AmountInput — contract detail lookup", () => {
  beforeEach(() => {
    lookupTokenInfo.mockReset();
  });

  it("shows a reading state and flags the lookup as in flight", async () => {
    let resolveLookup!: (value: { token: TokenInfo; detected: boolean }) => void;
    lookupTokenInfo.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    const onLookupChange = vi.fn();
    renderInput({ token: { contractId: VALID_CONTRACT, symbol: "", decimals: 7 }, onLookupChange });

    expect(screen.getByText(/Reading token details from the contract/)).toBeInTheDocument();
    expect(onLookupChange).toHaveBeenCalledWith(true);
    expect(lookupTokenInfo).toHaveBeenCalledWith(VALID_CONTRACT);

    await act(async () => {
      resolveLookup({ token: { contractId: VALID_CONTRACT, symbol: "", decimals: 7 }, detected: false });
    });
    expect(onLookupChange).toHaveBeenLastCalledWith(false);
  });

  it("applies detected symbol and decimals and locks the fields", async () => {
    lookupTokenInfo.mockResolvedValue({
      token: { contractId: VALID_CONTRACT, symbol: "USDC", decimals: 12 },
      detected: true,
    });
    const onLookupChange = vi.fn();
    render(<Controlled token={{ contractId: VALID_CONTRACT, symbol: "", decimals: 7 }} onLookupChange={onLookupChange} />);

    await screen.findByText("Detected USDC with 12 decimals from the token contract.");
    expect(onLookupChange).toHaveBeenLastCalledWith(false);
    // decimalsText resyncs via an effect once the parent stores the detected decimals.
    await waitFor(() => expect(decimalsField()).toHaveValue(12));
    expect(screen.getByLabelText("Symbol")).toHaveAttribute("readonly");
    expect(decimalsField()).toHaveAttribute("readonly");
  });

  it("falls back to manual entry when the contract cannot be read", async () => {
    lookupTokenInfo.mockResolvedValue({
      token: { contractId: VALID_CONTRACT, symbol: "", decimals: 7 },
      detected: false,
    });
    const onLookupChange = vi.fn();
    renderInput({ token: { contractId: VALID_CONTRACT, symbol: "", decimals: 7 }, onLookupChange });

    await screen.findByText(/Couldn't read this token's details/);
    expect(onLookupChange).toHaveBeenLastCalledWith(false);
    expect(decimalsField()).not.toHaveAttribute("readonly");
  });

  it("does not look up an invalid contract ID", () => {
    const onLookupChange = vi.fn();
    renderInput({ token: { contractId: "not-a-contract", symbol: "", decimals: 7 }, onLookupChange });

    expect(lookupTokenInfo).not.toHaveBeenCalled();
    expect(onLookupChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/Reading token details/)).toBeNull();
  });
});
