"use client";

import { use } from "react";
import Link from "next/link";
import { useStream } from "@/hooks/useStream";
import { useWallet } from "@/hooks/useWallet";
import { StreamDetails } from "@/components/stream/StreamDetails";
import { StreamActions } from "@/components/stream/StreamActions";
import { StreamStatusBadge } from "@/components/stream/StreamStatusBadge";
import { StartsInCountdown } from "@/components/stream/StartsInCountdown";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { csvFilename, streamToCsv, streamToJson } from "@/lib/streamList";
import type { Stream } from "@/types";

export default function StreamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { stream, isLoading, error, notConfigured, refetch } = useStream(id);
  const wallet = useWallet();

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl justify-center px-4 py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Contracts not yet configured"
          description="The Stream contract ID hasn't been set for this environment yet. Once the stellar-stream-hive-contract repo deploys to testnet, set NEXT_PUBLIC_STREAM_CONTRACT_ID to view live stream data here."
        />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ErrorState message={error ?? "Stream not found."} onRetry={refetch} />
      </div>
    );
  }

  const isActive = stream.status === "active" || stream.status === "cliff";
  // The connected wallet determines where "Back" should return the user to:
  // the Sending list if they're the sender, Receiving if they're the
  // recipient, otherwise fall back to the home page.
  const isSender = wallet.publicKey != null && wallet.publicKey === stream.sender;
  const isRecipient = wallet.publicKey != null && wallet.publicKey === stream.recipient;
  const backHref = isSender ? "/sending" : isRecipient ? "/receiving" : "/";
  const backLabel = isSender ? "Back to sending" : isRecipient ? "Back to receiving" : "Back home";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href={backHref} className="text-sm text-muted hover:text-white">
          ← {backLabel}
        </Link>
        <div className="flex items-center gap-3">
          <CopyButton
            value={() => (typeof window !== "undefined" ? window.location.href : "")}
            label="Copy link"
          />
          <ExportButtons stream={stream} />
          <StreamStatusBadge status={stream.status} />
        </div>
      </div>

      {stream.status === "scheduled" && (
        <StartsInCountdown startTime={stream.startTime} className="mb-2 block text-sm text-muted" />
      )}
      <StreamDetails stream={stream} isActive={isActive} />
      <StreamActions
        stream={stream}
        connectedAddress={wallet.publicKey}
        onWithdrawn={refetch}
        onCancelled={refetch}
      />
      {!wallet.isConnected && (
        <p className="mt-4 text-sm text-muted">Connect your wallet to withdraw or manage this stream.</p>
      )}
    </div>
  );
}

function ExportButtons({ stream }: { stream: Stream }) {
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadFile(streamToCsv(stream), csvFilename(`stream-${stream.id}`), "text/csv")}
        className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-surface-hover print:hidden"
        title="Download as CSV"
      >
        CSV
      </button>
      <button
        onClick={() => downloadFile(streamToJson(stream), `stream-${stream.id}.json`, "application/json")}
        className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-surface-hover print:hidden"
        title="Download as JSON"
      >
        JSON
      </button>
    </div>
  );
}
