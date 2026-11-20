"use client";

import { useState } from "react";
import { fetchWithdrawableOnChain, withdrawOnChain, ContractNotConfiguredError } from "@/lib/contracts";
import { describeFreighterError } from "@/lib/freighter";
import { formatBaseUnits, stellarExpertTxUrl } from "@/lib/format";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";
import { checkAmount } from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type Status = "idle" | "checking" | "signing" | "submitting" | "success" | "error";

export interface WithdrawButtonProps {
  streamId: string;
  recipientAddress: string;
  connectedAddress: string | null;
  tokenSymbol: string;
  tokenDecimals?: number;
  onWithdrawn?: () => void;
}

/**
 * Lets the recipient withdraw the max amount or a custom amount. Critically,
 * this NEVER trusts the client-side ticking estimate for the actual
 * transaction — it re-fetches the real withdrawable amount from the contract
 * at submit time and clamps the requested amount to it.
 */
export function WithdrawButton({
  streamId,
  recipientAddress,
  connectedAddress,
  tokenSymbol,
  tokenDecimals = 7,
  onWithdrawn,
}: WithdrawButtonProps) {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isFillingMax, setIsFillingMax] = useState(false);

  const isRecipient = connectedAddress && connectedAddress === recipientAddress;
  if (!isRecipient) return null;

  async function handleWithdraw() {
    setError(null);
    setStatus("checking");
    try {
      const actualWithdrawable = await fetchWithdrawableOnChain(streamId);

      let amount = actualWithdrawable;
      if (useCustom) {
        const result = checkAmount(customAmount, tokenDecimals);
        if (!result.ok) throw new Error(result.reason);
        const requested = result.baseUnits;
        if (requested <= 0n) throw new Error("Enter an amount greater than zero.");
        if (requested > actualWithdrawable) {
          throw new Error(
            `Requested amount exceeds what's currently withdrawable on-chain ` +
              `(${formatBaseUnits(actualWithdrawable, tokenDecimals, { maxDecimals: 7, minDecimals: 2 })} ${tokenSymbol}). ` +
              `Refresh and try again.`
          );
        }
        amount = requested;
      }

      if (amount <= 0n) {
        throw new Error("Nothing is withdrawable yet.");
      }

      setStatus("signing");
      const result = await withdrawOnChain({ streamId, recipient: recipientAddress, amount });
      setTxHash(result.hash);
      setStatus("success");
      onWithdrawn?.();
    } catch (err) {
      if (err instanceof ContractNotConfiguredError) {
        setError(err.message);
      } else {
        setError(describeFreighterError(err));
      }
      setStatus("error");
    }
  }

  // Fills the custom field from the real on-chain amount. The field is only a convenience:
  // handleWithdraw re-fetches and clamps again at submit time.
  async function handleFillMax() {
    setError(null);
    setIsFillingMax(true);
    try {
      const actualWithdrawable = await fetchWithdrawableOnChain(streamId);
      setCustomAmount(formatBaseUnits(actualWithdrawable, tokenDecimals, { maxDecimals: tokenDecimals, grouped: false }));
    } catch (err) {
      if (err instanceof ContractNotConfiguredError) {
        setError(err.message);
      } else {
        setError(describeFreighterError(err));
      }
    } finally {
      setIsFillingMax(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        Withdraw
      </Button>
    );
  }

  if (status === "success" && txHash) {
    return (
      <div className="card border-primary/30 bg-primary/5">
        <p className="font-semibold text-primary">Withdrawal submitted</p>
        {(() => {
          const explorerUrl = stellarExpertTxUrl(txHash, STELLAR_EXPERT_NETWORK);
          return (
            explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-accent underline"
              >
                View transaction on Stellar Expert
              </a>
            )
          );
        })()}
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => {
            setOpen(false);
            setStatus("idle");
            setTxHash(null);
            setUseCustom(false);
            setCustomAmount("");
          }}
        >
          Close
        </Button>
      </div>
    );
  }

  const isBusy = status === "checking" || status === "signing" || status === "submitting";

  return (
    <div className="card">
      <p className="mb-3 font-semibold">Withdraw funds</p>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setUseCustom(false)}
          aria-pressed={!useCustom}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            !useCustom ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
          }`}
        >
          Max withdrawable
        </button>
        <button
          type="button"
          onClick={() => setUseCustom(true)}
          aria-pressed={useCustom}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            useCustom ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
          }`}
        >
          Custom amount
        </button>
      </div>

      {useCustom && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder={`Amount in ${tokenSymbol}`}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="input-field flex-1"
          />
          <Button
            variant="secondary"
            onClick={handleFillMax}
            disabled={isBusy || isFillingMax}
            isLoading={isFillingMax}
          >
            Max
          </Button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleWithdraw}
          disabled={isBusy}
          isLoading={isBusy}
        >
          {status === "checking" && "Checking on-chain balance…"}
          {status === "signing" && "Confirm in wallet…"}
          {status === "submitting" && "Submitting…"}
          {!isBusy && "Confirm withdrawal"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setOpen(false)}
          disabled={isBusy}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
