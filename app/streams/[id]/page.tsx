"use client";

import Link from "next/link";
import { useStream } from "@/hooks/useStream";
import { useWallet } from "@/hooks/useWallet";
import { StreamDetails } from "@/components/stream/StreamDetails";
import { StreamActions } from "@/components/stream/StreamActions";
import { StreamStatusBadge } from "@/components/stream/StreamStatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { LedgerSnapshotProvider } from "@/hooks/useLedgerSnapshot";

export default function StreamDetailPage({ params }: { params: { id: string } }) {
  const { stream, isLoading, error, notConfigured, refetch } = useStream(params.id);
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
    <LedgerSnapshotProvider enabled={isActive}>
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
            <StreamStatusBadge status={stream.status} />
          </div>
        </div>

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
    </LedgerSnapshotProvider>
  );
}
