import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import type { Stream } from "@/types";
import { formatTokenAmount, shortenAddress } from "@/lib/format";
import { computeProgress } from "@/lib/streaming";
import { StreamStatusBadge } from "@/components/stream/StreamStatusBadge";
import { LiveBalance } from "@/components/stream/LiveBalance";
import { CopyButton } from "@/components/ui/CopyButton";
import { useLiveBalance } from "@/hooks/useLiveBalance";

export interface StreamCardProps {
  stream: Stream;
  /** Which side of the stream the current viewer is on, to decide what to emphasize. */
  role: "sender" | "recipient";
  actions?: React.ReactNode;
}

/** A compact summary card for a stream, used on the Sending and Receiving pages. */
export function StreamCard({ stream, role, actions }: StreamCardProps) {
  const counterpartLabel = role === "sender" ? "Recipient" : "Sender";
  const counterpartAddress = role === "sender" ? stream.recipient : stream.sender;
  const isLive = stream.status === "active" || stream.status === "cliff";
  const progress = computeProgress(stream.startLedger, stream.endLedger);

  const liveBalance = useLiveBalance({
    totalAmount: stream.totalAmount,
    withdrawnAmount: stream.withdrawnAmount,
    startLedger: stream.startLedger,
    endLedger: stream.endLedger,
    cliffLedger: stream.cliffLedger,
    enabled: isLive,
  });

  const endDate = stream.endTime ? new Date(stream.endTime) : null;
  const hasValidEndDate = endDate !== null && !Number.isNaN(endDate.getTime());
  const endLabel = hasValidEndDate
    ? endDate.getTime() > Date.now()
      ? `Ends in ${formatDistanceToNow(endDate)}`
      : `Ended ${formatDistanceToNow(endDate)} ago`
    : null;

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{counterpartLabel}</p>
          <div className="flex items-center gap-1">
            <p className="font-mono text-sm" title={counterpartAddress}>
              {shortenAddress(counterpartAddress)}
            </p>
            <CopyButton value={counterpartAddress} label="Copy address" />
          </div>
        </div>
        <StreamStatusBadge status={stream.status} />
      </div>

      {hasValidEndDate && endLabel ? (
        <p className="text-xs text-muted" title={format(endDate, "PPpp")}>
          {endLabel}
        </p>
      ) : null}

      {role === "recipient" ? (
        liveBalance.isLoading ? (
          <div>
            <p className="text-xs text-muted">Withdrawable</p>
            <p className="mono-tabular text-xl font-semibold text-muted" aria-busy="true">
              Loading…
            </p>
          </div>
        ) : (
          <LiveBalance
            totalAmount={stream.totalAmount}
            withdrawnAmount={stream.withdrawnAmount}
            startLedger={stream.startLedger}
            endLedger={stream.endLedger}
            cliffLedger={stream.cliffLedger}
            tokenSymbol={stream.token.symbol}
            tokenDecimals={stream.token.decimals}
            enabled={isLive}
            size="sm"
            label="Withdrawable"
          />
        )
      ) : (
        <div>
          <p className="text-xs text-muted">Total commitment</p>
          <p className="mono-tabular text-xl font-semibold">
            {formatTokenAmount(BigInt(stream.totalAmount), stream.token.symbol, stream.token.decimals, 4)}
          </p>
        </div>
      )}

      {progress === null ? (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true" />
          <p className="mt-1 text-xs text-muted">Progress unavailable</p>
        </div>
      ) : (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Stream progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Link href={`/streams/${stream.id}`} className="text-sm font-medium text-accent hover:underline">
          View details →
        </Link>
        {actions}
      </div>
    </div>
  );
}
