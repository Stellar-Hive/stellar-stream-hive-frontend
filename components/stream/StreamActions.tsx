import type { Stream } from "@/types";
import { WithdrawButton } from "@/components/stream/WithdrawButton";
import { CancelButton } from "@/components/stream/CancelButton";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";

export interface StreamActionsProps {
  stream: Stream;
  connectedAddress: string | null;
  onWithdrawn?: () => void;
  onCancelled?: () => void;
}

/** Action buttons for a stream (withdraw and cancel). */
export function StreamActions({
  stream,
  connectedAddress,
  onWithdrawn,
  onCancelled,
}: StreamActionsProps) {
  const isActive = stream.status === "active" || stream.status === "cliff";
  // The contract allows cancelling any stream that is not Cancelled or Completed,
  // including Pending/scheduled ones (sender is refunded in full for unstarted streams).
  const isCancellable =
    stream.cancellable &&
    (stream.status === "active" || stream.status === "cliff" || stream.status === "scheduled");

  return (
    <div className="flex flex-wrap gap-3">
      <WithdrawButton
        streamId={stream.id}
        recipientAddress={stream.recipient}
        connectedAddress={connectedAddress}
        tokenSymbol={stream.token.symbol}
        tokenDecimals={stream.token.decimals}
        onWithdrawn={onWithdrawn}
      />
      <CancelButton
        streamId={stream.id}
        senderAddress={stream.sender}
        connectedAddress={connectedAddress}
        cancellable={isCancellable}
        tokenSymbol={stream.token.symbol}
        tokenDecimals={stream.token.decimals}
        onCancelled={onCancelled}
      />
    </div>
  );
}
