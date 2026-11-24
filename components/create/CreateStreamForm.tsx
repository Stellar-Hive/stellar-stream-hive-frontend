"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { createStreamOnChain, isStreamContractConfigured, ContractNotConfiguredError } from "@/lib/contracts";
import { describeFreighterError } from "@/lib/freighter";
import { formatRateFromBaseUnits, stellarExpertTxUrl } from "@/lib/format";
import { parseStreamPrefill, hasAnyPrefillValue } from "@/lib/createStreamPrefill";
import { clearStreamDraft, loadStreamDraft, saveStreamDraft } from "@/lib/createStreamDraft";
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
  const searchParams = useSearchParams();

  // URL query params (e.g. a payroll link, an invoice, or the "Duplicate" action) represent an
  // explicit, fresh intent and take priority over a leftover draft from a previous visit -- the
  // draft is only consulted when there is nothing relevant in the URL.
  const prefill = useMemo(() => parseStreamPrefill(searchParams), [searchParams]);
  const hasPrefill = hasAnyPrefillValue(prefill);
  const draft = useMemo(() => (hasPrefill ? null : loadStreamDraft()), [hasPrefill]);

  const [recipient, setRecipient] = useState(() => prefill.recipient ?? draft?.recipient ?? "");
  const [amount, setAmount] = useState(() => prefill.amount ?? draft?.amount ?? "");
  const [isLookingUpToken, setIsLookingUpToken] = useState(false);
  const [token, setToken] = useState<TokenInfo>(() => {
    if (prefill.tokenContractId) {
      const isNative = prefill.tokenContractId === nativeTokenContractId();
      return { contractId: prefill.tokenContractId, symbol: isNative ? "XLM" : "", decimals: 7 };
    }
    if (draft) {
      return { contractId: draft.tokenContractId, symbol: draft.tokenSymbol, decimals: draft.tokenDecimals };
    }
    return { contractId: nativeTokenContractId(), symbol: "XLM", decimals: 7 };
  });
  const [startDate, setStartDate] = useState(() =>
    draft ? new Date(draft.startDate) : new Date(Date.now() + 5 * 60_000)
  );
  const [cliffDate, setCliffDate] = useState<Date | null>(() => (draft?.cliffDate ? new Date(draft.cliffDate) : null));
  const [endDate, setEndDate] = useState(() =>
    draft ? new Date(draft.endDate) : new Date(Date.now() + 30 * ONE_DAY_MS)
  );
  const [cancellable, setCancellable] = useState(() => prefill.cancellable ?? draft?.cancellable ?? true);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ streamId: string; hash: string } | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const validationErrorsRef = useRef<HTMLDivElement>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const confirmSummaryRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const preConfirmFocusRef = useRef<HTMLElement | null>(null);

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

  // Persist whatever has been typed so far, so an accidental reload doesn't lose it. Never
  // runs with a wallet secret or signed XDR in scope -- this form only ever holds plain
  // stream parameters.
  useEffect(() => {
    saveStreamDraft({
      recipient,
      amount,
      tokenContractId: token.contractId,
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      cancellable,
      startDate: startDate.toISOString(),
      cliffDate: cliffDate ? cliffDate.toISOString() : null,
      endDate: endDate.toISOString(),
    });
  }, [recipient, amount, token, cancellable, startDate, cliffDate, endDate]);

  // Focus the validation-error summary when it appears
  useEffect(() => {
    if (showValidationErrors && validationErrorsRef.current) {
      validationErrorsRef.current.focus();
    }
  }, [showValidationErrors]);

  // Hide the validation-error summary once all errors are resolved
  useEffect(() => {
    if (canSubmit) setShowValidationErrors(false);
  }, [canSubmit]);

  // Focus the confirm-and-sign summary when it appears
  useEffect(() => {
    if (confirmStep && confirmSummaryRef.current) {
      confirmSummaryRef.current.focus();
    }
  }, [confirmStep]);

  function handleSubmitClick() {
    if (!canSubmit) {
      setShowValidationErrors(true);
      return;
    }
    preConfirmFocusRef.current = document.activeElement as HTMLElement | null;
    setShowValidationErrors(false);
    setConfirmStep(true);
  }

  function handleBackFromConfirm() {
    setConfirmStep(false);
    setError(null);
    (preConfirmFocusRef.current ?? submitButtonRef.current)?.focus();
  }

  async function handleConfirm() {
    if (!canSubmit) {
      // Defensive: something (e.g. wallet disconnecting) could have invalidated the form
      // while the confirm step was open.
      setConfirmStep(false);
      setShowValidationErrors(true);
      return;
    }

    const sender = wallet.publicKey;
    if (!sender) return;

    setError(null);
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
      clearStreamDraft();
    } catch (err) {
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

  const confirmDurationSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
  const confirmRate =
    amountCheck.ok && confirmDurationSeconds > 0
      ? formatRateFromBaseUnits(amountCheck.baseUnits, confirmDurationSeconds, token.symbol, token.decimals)
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {confirmStep ? (
        <div
          ref={confirmSummaryRef}
          role="group"
          aria-label="Confirm stream details"
          tabIndex={-1}
          className="card space-y-5 focus:outline-none"
        >
          <h2 className="text-lg font-bold">Confirm stream details</h2>
          <dl className="space-y-2.5 text-sm">
            <ConfirmRow label="Recipient" value={recipient} mono />
            <ConfirmRow label="Token" value={`${token.symbol} (${token.contractId})`} mono />
            <ConfirmRow label="Amount" value={`${amount} ${token.symbol}`} />
            <ConfirmRow label="Start" value={startDate.toLocaleString()} />
            <ConfirmRow label="Cliff" value={cliffDate ? cliffDate.toLocaleString() : "None"} />
            <ConfirmRow label="End" value={endDate.toLocaleString()} />
            <ConfirmRow label="Cancellable" value={cancellable ? "Yes" : "No"} />
            {confirmRate && <ConfirmRow label="Rate" value={`${confirmRate.perDay} / day`} />}
          </dl>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={handleBackFromConfirm} disabled={isBusy} className="btn-secondary flex-1">
              Back
            </button>
            <button type="button" onClick={handleConfirm} disabled={isBusy} className="btn-primary flex-1">
              {isBusy ? (
                <>
                  <Spinner decorative />
                  <span>Creating stream</span>
                </>
              ) : (
                "Confirm and sign"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="card space-y-6">
          {showValidationErrors && summaryErrors.length > 0 && (
            <div
              ref={validationErrorsRef}
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
            <button
              ref={submitButtonRef}
              type="button"
              onClick={handleSubmitClick}
              disabled={isBusy}
              className="btn-primary w-full"
            >
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
      )}

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

function ConfirmRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "break-all text-right font-mono text-xs" : "text-right font-medium"}>{value}</dd>
    </div>
  );
}
