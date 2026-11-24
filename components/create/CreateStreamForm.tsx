"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { RecipientInput } from "@/components/create/RecipientInput";
import { AmountInput } from "@/components/create/AmountInput";
import { ScheduleInput } from "@/components/create/ScheduleInput";
import { StreamPreview } from "@/components/create/StreamPreview";
import { Spinner } from "@/components/ui/Spinner";
import {
  fetchLatestLedgerSnapshot,
  isValidRecipientAddress,
  isValidStellarAddress,
  nativeTokenContractId,
  STELLAR_EXPERT_NETWORK,
} from "@/lib/stellar";
import { dateToEstimatedLedger } from "@/lib/streaming";
import { checkAmount, checkRecipientNotSender } from "@/lib/validation";
import {
  createStreamOnChain,
  isStreamContractConfigured,
  ContractNotConfiguredError,
  TransactionTimeoutError,
} from "@/lib/contracts";
import { TransactionTimeoutNotice } from "@/components/ui/TransactionTimeoutNotice";
import { describeFreighterError } from "@/lib/freighter";
import { stellarExpertTxUrl } from "@/lib/format";
import type { TokenInfo } from "@/types";
import { ONE_DAY_MS } from "@/lib/constants";

type Status = "idle" | "creating" | "success" | "error";

export function CreateStreamForm() {
  // Remounting the fields is the simplest full reset: every input, the token lookup and the
  // success/error state all return to their defaults.
  const [formKey, setFormKey] = useState(0);
  return <CreateStreamFields key={formKey} onReset={() => setFormKey((key) => key + 1)} />;
}

function CreateStreamFields({ onReset }: { onReset: () => void }) {
  const wallet = useWallet();
  const router = useRouter();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLookingUpToken, setIsLookingUpToken] = useState(false);
  const [token, setToken] = useState<TokenInfo>({ contractId: nativeTokenContractId(), symbol: "XLM", decimals: 7 });
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 5 * 60_000));
  const [cliffDate, setCliffDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 30 * ONE_DAY_MS));
  const [cancellable, setCancellable] = useState(true);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [timedOutHash, setTimedOutHash] = useState<string | null>(null);
  const [result, setResult] = useState<{ streamId: string; hash: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const isRecipientValid =
    isValidRecipientAddress(recipient) && checkRecipientNotSender(recipient, wallet.publicKey).ok;
  const amountCheck = checkAmount(amount, token.decimals);
  const isAmountValid = amountCheck.ok;
  const isTokenValid = token.symbol.length > 0 && isValidStellarAddress(token.contractId, "contract");
  const isScheduleValid =
    endDate.getTime() > startDate.getTime() &&
    (!cliffDate || (cliffDate.getTime() >= startDate.getTime() && cliffDate.getTime() <= endDate.getTime()));

  const canSubmit =
    isRecipientValid &&
    isAmountValid &&
    isTokenValid &&
    isScheduleValid &&
    !isLookingUpToken &&
    wallet.isConnected &&
    isStreamContractConfigured();

  // Build the list of validation errors for the summary
  const summaryErrors: { message: string; fieldId: string }[] = [];
  if (!wallet.isConnected) {
    summaryErrors.push({ message: "Connect your wallet to continue.", fieldId: "wallet-section" });
  }
  if (wallet.isConnected && !isRecipientValid) {
    const reason =
      recipient.length === 0
        ? "Recipient address is required."
        : !isValidRecipientAddress(recipient)
        ? "Recipient address is not a valid Stellar account address."
        : "Recipient cannot be the same as the sender.";
    summaryErrors.push({ message: reason, fieldId: "recipient-field" });
  }
  if (!isAmountValid) {
    summaryErrors.push({
      message: amountCheck.reason ?? "Enter a valid amount.",
      fieldId: "amount-field",
    });
  }
  if (!isTokenValid) {
    summaryErrors.push({ message: "Select a valid token.", fieldId: "amount-field" });
  }
  if (!isScheduleValid) {
    summaryErrors.push({
      message: "Check the stream schedule: end must be after start, and cliff must be between start and end.",
      fieldId: "schedule-field",
    });
  }

  // Focus summary when it appears
  useEffect(() => {
    if (showSummary && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [showSummary]);

  // Hide summary once all errors are resolved
  useEffect(() => {
    if (canSubmit) setShowSummary(false);
  }, [canSubmit]);

  async function handleSubmit() {
    if (!canSubmit) {
      setShowSummary(true);
      return;
    }

    const sender = wallet.publicKey;
    if (!sender) return;

    setShowSummary(false);
    setError(null);
    setTimedOutHash(null);
    setStatus("creating");
    try {
      const reference = await fetchLatestLedgerSnapshot();
      const startLedger = dateToEstimatedLedger(startDate, reference);
      const endLedger = dateToEstimatedLedger(endDate, reference);
      const cliffLedger = cliffDate ? dateToEstimatedLedger(cliffDate, reference) : undefined;
      // Re-check at submit time: the token's decimals may have changed since the field was last edited.
      const finalAmount = checkAmount(amount, token.decimals);
      if (!finalAmount.ok) throw new Error(finalAmount.reason);
      const totalAmountBaseUnits = finalAmount.baseUnits;

      // No token `approve` is needed: the vault pulls the deposit with the sender's
      // signed `transfer`, authorised by this transaction (verified on testnet).
      const created = await createStreamOnChain({
        sender,
        recipient,
        tokenContractId: token.contractId,
        totalAmount: totalAmountBaseUnits,
        startLedger,
        endLedger,
        cliffLedger,
        cancellable,
      });

      setResult(created);
      setStatus("success");
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setTimedOutHash(err.hash);
        setStatus("error");
        return;
      }
      setError(err instanceof ContractNotConfiguredError ? err.message : describeFreighterError(err));
      setStatus("error");
    }
  }

  if (status === "success" && result) {
    return (
      <div role="status" className="card mx-auto max-w-lg border-primary/30 bg-primary/5 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Stream created</h2>
        <p className="mt-2 text-sm text-muted">
          Your stream is live and will begin accruing for the recipient as scheduled.
        </p>
        {(() => {
          const explorerUrl = stellarExpertTxUrl(result.hash, STELLAR_EXPERT_NETWORK);
          return (
            explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-accent underline"
              >
                View transaction on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )
          );
        })()}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push(`/streams/${result.streamId}`)}
            className="btn-primary w-full"
          >
            View stream
          </button>
          <button type="button" onClick={onReset} className="btn-secondary w-full">
            Create another stream
          </button>
        </div>
      </div>
    );
  }

  const isBusy = status === "creating";
  const contractsConfigured = isStreamContractConfigured();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card space-y-6">
        {showSummary && summaryErrors.length > 0 && (
          <div
            ref={summaryRef}
            role="alert"
            aria-label="Form errors"
            tabIndex={-1}
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger focus:outline-none"
          >
            <p className="mb-2 font-semibold">Please fix the following errors before submitting:</p>
            <ul className="list-disc space-y-1 pl-5">
              {summaryErrors.map((e) => (
                <li key={e.fieldId}>
                  <a
                    href={`#${e.fieldId}`}
                    className="underline hover:text-danger/80 focus:outline-none focus:ring-1 focus:ring-danger"
                  >
                    {e.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!contractsConfigured && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            The Stream contract isn&apos;t configured for this environment yet (
            <code className="font-mono text-xs">NEXT_PUBLIC_STREAM_CONTRACT_ID</code>). You can fill out the form to
            preview a stream, but submitting will be disabled until a contract is deployed and configured.
          </div>
        )}

        <div id="recipient-field">
          <RecipientInput value={recipient} onChange={setRecipient} senderAddress={wallet.publicKey} />
        </div>
        <div id="amount-field">
          <AmountInput
            amount={amount}
            onAmountChange={setAmount}
            token={token}
            onTokenChange={setToken}
            onLookupChange={setIsLookingUpToken}
          />
        </div>
        <div id="schedule-field">
          <ScheduleInput
            startDate={startDate}
            onStartDateChange={setStartDate}
            cliffDate={cliffDate}
            onCliffDateChange={setCliffDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cancellable}
              onChange={(e) => setCancellable(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background accent-primary"
            />
            Sender can cancel this stream before it ends
          </label>
          {!cancellable && (
            <p className="text-xs text-warning">
              Funds cannot be recovered by cancelling; they stream to the recipient until the end.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {timedOutHash && <TransactionTimeoutNotice hash={timedOutHash} />}

        {!wallet.isConnected ? (
          <div id="wallet-section">
            <button type="button" onClick={wallet.connect} disabled={wallet.isConnecting} className="btn-primary w-full">
              {wallet.isConnecting ? (
                <>
                  <Spinner decorative />
                  <span>Connecting</span>
                </>
              ) : (
                "Connect wallet to continue"
              )}
            </button>
          </div>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={isBusy} className="btn-primary w-full">
            {isBusy ? (
              <>
                <Spinner decorative />
                <span>Creating stream</span>
              </>
            ) : (
              "Create stream"
            )}
          </button>
        )}
      </div>

      <StreamPreview
        recipient={recipient}
        amount={amount}
        token={token}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
