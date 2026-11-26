"use client";

import { isValidRecipientAddress } from "@/lib/stellar";
import { checkRecipientNotSender } from "@/lib/validation";

export interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  /** The connected wallet's address, used to reject streaming to yourself. */
  senderAddress?: string | null;
}

/** Recipient address field with inline Stellar G-address validation (56 chars, base32, starts with 'G'). */
export function RecipientInput({ value, onChange, senderAddress = null }: RecipientInputProps) {
  const touched = value.length > 0;
  const isValidAddress = isValidRecipientAddress(value);
  const selfCheck = checkRecipientNotSender(value, senderAddress);
  const isValid = isValidAddress && selfCheck.ok;

  const showAddressError = touched && !isValidAddress;
  const showSelfError = touched && isValidAddress && !selfCheck.ok;
  const hasError = showAddressError || showSelfError;
  const messageId = "recipient-error";

  return (
    <div>
      <label className="label" htmlFor="recipient">
        Recipient address
      </label>
      <input
        id="recipient"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="G..."
        spellCheck={false}
        autoComplete="off"
        aria-invalid={hasError}
        aria-describedby={hasError ? messageId : undefined}
        className={`input-field font-mono text-sm ${touched && !isValid ? "border-danger focus:border-danger focus:ring-danger" : ""}`}
      />
      {showAddressError && (
        <p id={messageId} className="mt-1.5 text-xs text-danger">
          Enter a valid Stellar account address — 56 characters, starting with &quot;G&quot;.
        </p>
      )}
      {showSelfError && (
        <p id={messageId} className="mt-1.5 text-xs text-danger">
          {selfCheck.reason}
        </p>
      )}
      {touched && isValid && <p className="mt-1.5 text-xs text-primary">Valid Stellar address.</p>}
    </div>
  );
}
