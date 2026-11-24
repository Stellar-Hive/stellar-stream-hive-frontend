"use client";

import { useEffect, useRef, useState } from "react";
import {
  cancelStreamOnChain,
  fetchStreamOnChain,
  ContractNotConfiguredError,
  TransactionTimeoutError,
} from "@/lib/contracts";
import { TransactionTimeoutNotice } from "@/components/ui/TransactionTimeoutNotice";
import { fetchLatestLedgerSnapshot } from "@/lib/stellar";
import { computeCancelSplit, computeStreamedAmount } from "@/lib/streaming";
import { describeFreighterError } from "@/lib/freighter";
import { formatTokenAmount, stellarExpertTxUrl } from "@/lib/format";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  CANCEL_STREAM_NOT_FOUND,
  CANCEL_COMPUTING_SPLIT,
  CANCEL_CONFIRM_BUTTON,
  CANCEL_KEEP_BUTTON,
  CANCEL_SIGNING,
  CANCEL_SUCCESS,
  CANCEL_VIEW_TX,
  CANCEL_DIALOG_HEADING,
  CANCEL_DIALOG_BODY,
} from "@/lib/messages";

type Status = "idle" | "loadingSplit" | "confirming" | "signing" | "success" | "error";

export interface CancelButtonProps {
  streamId: string;
  senderAddress: string;
  connectedAddress: string | null;
  cancellable: boolean;
  tokenSymbol: string;
  tokenDecimals?: number;
  onCancelled?: () => void;
}

interface Split {
  recipientGets: bigint;
  senderGets: bigint;
}

/**
 * Lets the sender cancel a cancellable stream. Before submitting, it fetches
 * the live on-chain streamed amount and shows the exact resulting split:
 * the recipient keeps everything streamed so far (minus what they already
 * withdrew), and the sender is refunded the unstreamed remainder.
 */
export function CancelButton({
  streamId,
  senderAddress,
  connectedAddress,
  cancellable,
  tokenSymbol,
  tokenDecimals = 7,
  onCancelled,
}: CancelButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [split, setSplit] = useState<Split | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOutHash, setTimedOutHash] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) {
      const focusable = getFocusableElements(panel);
      (focusable[0] ?? panel).focus();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && status !== "signing") {
        close();
        return;
      }
      if (e.key === "Tab") {
        const currentPanel = panelRef.current;
        if (!currentPanel) return;
        const focusable = getFocusableElements(currentPanel);
        if (focusable.length === 0) {
          e.preventDefault();
          currentPanel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !currentPanel.contains(active)) {
            e.preventDefault();
            last?.focus();
          }
        } else if (active === last || !currentPanel.contains(active)) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, status]);

  const isSender = connectedAddress && connectedAddress === senderAddress;
  if (!isSender || !cancellable) return null;

  async function openModal() {
    setOpen(true);
    setStatus("loadingSplit");
    setError(null);
    try {
      const [stream, ledgerSnapshot] = await Promise.all([fetchStreamOnChain(streamId), fetchLatestLedgerSnapshot()]);
      if (!stream) throw new Error(CANCEL_STREAM_NOT_FOUND);

      const totalAmount = BigInt(stream.totalAmount);
      const streamedNow = computeStreamedAmount({
        totalAmount,
        startLedger: stream.startLedger,
        endLedger: stream.endLedger,
        currentLedger: ledgerSnapshot.ledger,
      });

      setSplit(
        computeCancelSplit({
          totalAmount,
          streamedAmount: streamedNow,
          withdrawnAmount: BigInt(stream.withdrawnAmount),
          cliffLedger: stream.cliffLedger,
          currentLedger: ledgerSnapshot.ledger,
        })
      );
      setStatus("confirming");
    } catch (err) {
      setError(err instanceof ContractNotConfiguredError ? err.message : describeFreighterError(err));
      setStatus("error");
    }
  }

  async function handleConfirm() {
    setStatus("signing");
    setError(null);
    setTimedOutHash(null);
    try {
      const result = await cancelStreamOnChain({ streamId, sender: senderAddress });
      setTxHash(result.hash);
      setStatus("success");
      onCancelled?.();
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setTimedOutHash(err.hash);
        setStatus("error");
        return;
      }
      setError(describeFreighterError(err));
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setStatus("idle");
    setSplit(null);
    setError(null);
    setTimedOutHash(null);
    setTxHash(null);
    triggerRef.current?.focus();
  }

  if (!open) {
    return (
      <Button ref={triggerRef} variant="danger" onClick={openModal}>
        Cancel stream
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-stream-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== "signing") close();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <h3 id="cancel-stream-heading" className="mb-1 text-lg font-semibold">
          {CANCEL_DIALOG_HEADING}
        </h3>
        <p className="mb-4 text-sm text-muted">
          {CANCEL_DIALOG_BODY}
        </p>

        {status === "loadingSplit" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner size="sm" /> {CANCEL_COMPUTING_SPLIT}
          </div>
        )}

        {status === "error" && error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        )}
        {status === "error" && timedOutHash && (
          <TransactionTimeoutNotice hash={timedOutHash} className="mb-4 text-sm text-danger" />
        )}

        {split && (status === "confirming" || status === "signing") && (
          <div className="mb-4 space-y-2 rounded-xl border border-border bg-background p-4">
            <SplitRow
              label="Recipient receives"
              value={formatTokenAmount(split.recipientGets, tokenSymbol, tokenDecimals, 7)}
            />
            <SplitRow
              label="Sender refunded"
              value={formatTokenAmount(split.senderGets, tokenSymbol, tokenDecimals, 7)}
            />
          </div>
        )}

        {status === "success" && txHash && (
          <div role="status" className="mb-4">
            <p className="mb-2 text-sm font-medium text-primary">{CANCEL_SUCCESS}</p>
            {(() => {
              const explorerUrl = stellarExpertTxUrl(txHash, STELLAR_EXPERT_NETWORK);
              return (
                explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
                    {CANCEL_VIEW_TX}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )
              );
            })()}
          </div>
        )}

        <div className="flex gap-2">
          {status === "success" ? (
            <Button variant="secondary" className="flex-1" onClick={close}>
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleConfirm}
                disabled={status !== "confirming"}
                isLoading={status === "signing"}
              >
                {status === "signing" ? CANCEL_SIGNING : CANCEL_CONFIRM_BUTTON}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={close} disabled={status === "signing"}>
                {CANCEL_KEEP_BUTTON}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

function SplitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="mono-tabular font-semibold">{value}</span>
    </div>
  );
}
