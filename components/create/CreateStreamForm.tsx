"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { RecipientInput } from "@/components/create/RecipientInput";
import { AmountInput } from "@/components/create/AmountInput";
import { ScheduleInput } from "@/components/create/ScheduleInput";
import { StreamPreview } from "@/components/create/StreamPreview";
import { Spinner } from "@/components/ui/Spinner";
import { fetchLatestLedgerSnapshot, isValidRecipientAddress, isValidStellarAddress, nativeTokenContractId, STELLAR_EXPERT_NETWORK } from "@/lib/stellar";
import { dateToEstimatedLedger } from "@/lib/streaming";
import { checkAmount, checkRecipientNotSender } from "@/lib/validation";
import { createStreamOnChain, isStreamContractConfigured, ContractNotConfiguredError } from "@/lib/contracts";
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
  const [result, setResult] = useState<{ streamId: string; hash: string } | null>(null);

  const isRecipientValid = isValidRecipientAddress(recipient) && checkRecipientNotSender(recipient, wallet.publicKey).ok;
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

  async function handleSubmit() {
    // The submit button only renders once the wallet is connected, so the sender is set here.
    const sender = wallet.publicKey;
    if (!sender || !canSubmit) return;

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
    } catch (err) {
      setError(err instanceof ContractNotConfiguredError ? err.message : describeFreighterError(err));
      setStatus("error");
    }
  }

  if (status === "success" && result) {
    return (
      <div className="card mx-auto max-w-lg border-primary/30 bg-primary/5 text-center">
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
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-accent underline"
              >
                View transaction on Stellar Expert
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
        {!contractsConfigured && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            The Stream contract isn&apos;t configured for this environment yet (
            <code className="font-mono text-xs">NEXT_PUBLIC_STREAM_CONTRACT_ID</code>). You can fill out the form
            to preview a stream, but submitting will be disabled until a contract is deployed and configured.
          </div>
        )}
        <RecipientInput value={recipient} onChange={setRecipient} senderAddress={wallet.publicKey} />
        <AmountInput
          amount={amount}
          onAmountChange={setAmount}
          token={token}
          onTokenChange={setToken}
          onLookupChange={setIsLookingUpToken}
        />
        <ScheduleInput
          startDate={startDate}
          onStartDateChange={setStartDate}
          cliffDate={cliffDate}
          onCliffDateChange={setCliffDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
        />

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

        {error && <p className="text-sm text-danger">{error}</p>}

        {!wallet.isConnected ? (
          <button type="button" onClick={wallet.connect} disabled={wallet.isConnecting} className="btn-primary w-full">
            {wallet.isConnecting ? <Spinner label="Connecting" /> : "Connect wallet to continue"}
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!canSubmit || isBusy} className="btn-primary w-full">
            {isBusy ? <Spinner label="Creating stream" /> : "Create stream"}
          </button>
        )}
      </div>

      <StreamPreview
        recipient={recipient}
        amount={amount}
        token={token}
        startDate={startDate}
        cliffDate={cliffDate}
        endDate={endDate}
        cancellable={cancellable}
      />
    </div>
  );
}
