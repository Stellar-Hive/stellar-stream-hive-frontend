import { format } from "date-fns";
import type { Stream } from "@/types";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { LiveBalance } from "@/components/stream/LiveBalance";
import { StreamTimeline } from "@/components/stream/StreamTimeline";
import { StreamProgress } from "@/components/stream/StreamProgress";
import {
  formatRateFromBaseUnits,
  formatTokenAmount,
  shortenAddress,
  stellarExpertAccountUrl,
  stellarExpertTxUrl,
} from "@/lib/format";
import { getStreamContractId, isStreamContractConfigured } from "@/lib/contracts";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";

export interface StreamDetailsProps {
  stream: Stream;
  isActive: boolean;
}

/** The details card for a stream, showing balance, timeline, progress, and metadata. */
export function StreamDetails({ stream, isActive }: StreamDetailsProps) {
  const totalSeconds = (stream.endLedger - stream.startLedger) * AVERAGE_LEDGER_SECONDS;
  const rate = formatRateFromBaseUnits(
    BigInt(stream.totalAmount),
    totalSeconds,
    stream.token.symbol,
    stream.token.decimals,
  );
  const contractConfigured = isStreamContractConfigured();
  const contractId = contractConfigured ? getStreamContractId() : null;

  return (
    <>
      <Card className="mb-6">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted">
          <span>Stream #{stream.id}</span>
          <CopyButton value={stream.id} label="Copy ID" />
        </div>
        <LiveBalance
          totalAmount={stream.totalAmount}
          withdrawnAmount={stream.withdrawnAmount}
          startLedger={stream.startLedger}
          endLedger={stream.endLedger}
          cliffLedger={stream.cliffLedger}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          enabled={isActive}
        />

        <div className="my-6">
          <StreamTimeline
            startLedger={stream.startLedger}
            endLedger={stream.endLedger}
            cliffLedger={stream.cliffLedger}
            startTime={stream.startTime}
            endTime={stream.endTime}
            cliffTime={stream.cliffTime}
            enabled={isActive}
          />
        </div>

        <StreamProgress
          totalAmount={stream.totalAmount}
          withdrawnAmount={stream.withdrawnAmount}
          startLedger={stream.startLedger}
          endLedger={stream.endLedger}
          cliffLedger={stream.cliffLedger}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          enabled={isActive}
        />
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-muted">Parties</h3>
          <AddressRow label="Sender" address={stream.sender} />
          <AddressRow label="Recipient" address={stream.recipient} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-muted">Stream details</h3>
          <DetailRow label="Token" value={stream.token.symbol} />
          <DetailRow
            label="Total amount"
            value={formatTokenAmount(BigInt(stream.totalAmount), stream.token.symbol, stream.token.decimals, 4)}
          />
          <DetailRow
            label="Withdrawn"
            value={formatTokenAmount(
              BigInt(stream.withdrawnAmount),
              stream.token.symbol,
              stream.token.decimals,
              4,
            )}
          />
          <DetailRow label="Rate" value={`~${rate.perDay} / day`} />
          <DetailRow label="Start" value={format(stream.startTime, "PPpp")} />
          <DetailRow label="End" value={format(stream.endTime, "PPpp")} />
          {stream.cliffTime && <DetailRow label="Cliff" value={format(stream.cliffTime, "PPpp")} />}
          <DetailRow label="Cancellable" value={stream.cancellable ? "Yes" : "No"} />
          {contractId && stellarExpertAccountUrl(contractId, STELLAR_EXPERT_NETWORK) && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">Stream contract</span>
              <a
                href={stellarExpertAccountUrl(contractId, STELLAR_EXPERT_NETWORK)!}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                View on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
          {stream.createTxHash && stellarExpertTxUrl(stream.createTxHash, STELLAR_EXPERT_NETWORK) && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">Create tx</span>
              <a
                href={stellarExpertTxUrl(stream.createTxHash, STELLAR_EXPERT_NETWORK)!}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                View on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm last:mb-0">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-1">
        {(() => {
          const explorerUrl = stellarExpertAccountUrl(address, STELLAR_EXPERT_NETWORK);
          return explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              {shortenAddress(address)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span>{shortenAddress(address)}</span>
          );
        })()}
        <CopyButton value={address} label="Copy address" />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm last:mb-0">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
