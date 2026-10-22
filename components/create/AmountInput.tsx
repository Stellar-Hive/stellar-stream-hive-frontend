"use client";

import { useEffect, useRef, useState } from "react";
import { nativeTokenContractId, isValidStellarAddress } from "@/lib/stellar";
import { lookupTokenInfo } from "@/lib/tokens";
import { checkAmount } from "@/lib/validation";
import type { TokenInfo } from "@/types";

export interface AmountInputProps {
  amount: string;
  onAmountChange: (value: string) => void;
  token: TokenInfo;
  onTokenChange: (token: TokenInfo) => void;
  /** Reports whether a token lookup is in flight, so the form can hold off submitting until decimals are known. */
  onLookupChange?: (isLooking: boolean) => void;
}

type Detection = "idle" | "checking" | "detected" | "manual";

const XLM_TOKEN: TokenInfo = { contractId: nativeTokenContractId(), symbol: "XLM", decimals: 7 };

/** Total amount field plus a token selector (native XLM or a custom Stellar Asset Contract). */
export function AmountInput({ amount, onAmountChange, token, onTokenChange, onLookupChange }: AmountInputProps) {
  const isCustomToken = token.contractId !== XLM_TOKEN.contractId;
  const [detection, setDetection] = useState<Detection>("idle");
  // Raw text for the decimals field so it can be cleared while typing; the
  // stored token.decimals is always an integer.
  const [decimalsText, setDecimalsText] = useState(String(token.decimals));

  // Keep the text in sync when decimals change from outside (e.g. detection).
  useEffect(() => {
    setDecimalsText(String(token.decimals));
  }, [token.decimals]);

  // Keep the latest callbacks in refs so the lookup effect depends only on the contract id.
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;
  const onLookupChangeRef = useRef(onLookupChange);
  onLookupChangeRef.current = onLookupChange;

  // Read symbol/decimals from the token contract. Typing decimals by hand is
  // error-prone, and a wrong value silently mis-scales the deposit by 10^n.
  useEffect(() => {
    if (!isCustomToken || !isValidStellarAddress(token.contractId, "contract")) {
      setDetection("idle");
      onLookupChangeRef.current?.(false);
      return;
    }

    let cancelled = false;
    setDetection("checking");
    onLookupChangeRef.current?.(true);
    lookupTokenInfo(token.contractId).then(({ token: info, detected }) => {
      if (cancelled) return;
      if (detected) onTokenChangeRef.current(info);
      setDetection(detected ? "detected" : "manual");
      onLookupChangeRef.current?.(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isCustomToken, token.contractId]);

  const detected = detection === "detected";
  const amountCheck = amount.trim() === "" ? null : checkAmount(amount, token.decimals);
  const amountError = amountCheck && !amountCheck.ok ? amountCheck.reason : null;
  const amountIsValid = amountError === null;

  const contractIdInvalid = token.contractId !== "" && !isValidStellarAddress(token.contractId, "contract");
  const contractIdError = contractIdInvalid ? "Enter a valid Stellar contract ID." : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="amount">
          Total amount
        </label>
        <div className="flex gap-2">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            aria-invalid={!amountIsValid}
            aria-describedby={amountError ? "amount-error" : undefined}
            className={`input-field flex-1 ${!amountIsValid ? "border-danger" : ""}`}
          />
          <select
            aria-label="Token"
            value={isCustomToken ? "custom" : "xlm"}
            onChange={(e) => {
              if (e.target.value === "xlm") {
                onTokenChange(XLM_TOKEN);
              } else {
                onTokenChange({ contractId: "", symbol: "", decimals: 7 });
              }
            }}
            className="input-field w-32 shrink-0"
          >
            <option value="xlm">XLM</option>
            <option value="custom">Custom token</option>
          </select>
        </div>
        {amountError && (
          <p id="amount-error" className="mt-1.5 text-xs text-danger">
            {amountError}
          </p>
        )}
      </div>

      {isCustomToken && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="token-contract">
              Token contract ID
            </label>
            <input
              id="token-contract"
              type="text"
              value={token.contractId}
              onChange={(e) => onTokenChange({ ...token, contractId: e.target.value.trim() })}
              placeholder="C..."
              spellCheck={false}
              aria-invalid={contractIdInvalid}
              aria-describedby={contractIdError ? "token-contract-error" : undefined}
              className={`input-field font-mono text-sm ${contractIdInvalid ? "border-danger" : ""}`}
            />
            {contractIdError && (
              <p id="token-contract-error" className="mt-1.5 text-xs text-danger">
                {contractIdError}
              </p>
            )}
            {detection === "checking" && <p className="mt-1.5 text-xs text-muted">Reading token details from the contract…</p>}
            {detected && (
              <p className="mt-1.5 text-xs text-primary">
                Detected {token.symbol} with {token.decimals} decimals from the token contract.
              </p>
            )}
            {detection === "manual" && (
              <p className="mt-1.5 text-xs text-warning">
                Couldn&apos;t read this token&apos;s details. Enter the symbol and decimals yourself and double-check the
                decimals — a wrong value changes how much is deposited.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="token-symbol">
              Symbol
            </label>
            <input
              id="token-symbol"
              type="text"
              value={token.symbol}
              onChange={(e) => onTokenChange({ ...token, symbol: e.target.value.toUpperCase().slice(0, 12) })}
              placeholder="USDC"
              readOnly={detected}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="token-decimals">
              Decimals
            </label>
            <input
              id="token-decimals"
              type="number"
              min={0}
              max={18}
              step={1}
              value={decimalsText}
              readOnly={detected}
              onChange={(e) => {
                const raw = e.target.value;
                setDecimalsText(raw);
                const parsed = Number(raw);
                if (raw.trim() === "" || !Number.isFinite(parsed)) return;
                const decimals = Math.min(18, Math.max(0, Math.trunc(parsed)));
                if (decimals !== token.decimals) onTokenChange({ ...token, decimals });
              }}
              onBlur={() => setDecimalsText(String(token.decimals))}
              className="input-field"
            />
          </div>
        </div>
      )}
    </div>
  );
}
