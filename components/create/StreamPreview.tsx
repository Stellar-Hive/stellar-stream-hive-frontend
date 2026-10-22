"use client";

import { formatDistanceStrict } from "date-fns";
import { formatBaseUnits, formatRateFromBaseUnits } from "@/lib/format";
import { checkAmount } from "@/lib/validation";
import type { TokenInfo } from "@/types";

export interface StreamPreviewProps {
  amount: string;
  token: TokenInfo;
  startDate: Date;
  endDate: Date;
  recipient: string;
}

/** Live-updating summary of what the configured stream will do, before submission. */
export function StreamPreview({ amount, token, startDate, endDate, recipient }: StreamPreviewProps) {
  const durationSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
  const amountCheck = checkAmount(amount, token.decimals);
  const hasValidInputs = amountCheck.ok && durationSeconds > 0 && Boolean(token.symbol);

  if (!hasValidInputs || !amountCheck.ok) {
    return (
      <div className="card border-dashed text-sm text-muted">
        Fill in a recipient, amount, and schedule to see a live preview of the stream rate.
      </div>
    );
  }

  const totalAmount = amountCheck.baseUnits;
  const rate = formatRateFromBaseUnits(totalAmount, durationSeconds, token.symbol, token.decimals);
  const durationLabel = formatDistanceStrict(endDate, startDate);

  return (
    <div className="card border-primary/20 bg-primary/5">
      <p className="text-sm text-muted">This stream will pay</p>
      <p className="mono-tabular mt-1 text-2xl font-bold text-primary">{rate.perDay} / day</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <RateStat label="Per second" value={rate.perSecond} />
        <RateStat label="Per hour" value={rate.perHour} />
        <RateStat label="Per day" value={rate.perDay} />
      </div>
      <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
        <SummaryRow label="Recipient" value={recipient || "—"} mono />
        <SummaryRow label="Total amount" value={formatBaseUnits(totalAmount, token.decimals, { grouped: true }) + ` ${token.symbol}`} />
        <SummaryRow label="Duration" value={durationLabel} />
      </div>
    </div>
  );
}

function RateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className="text-muted">{label}</p>
      <p className="mono-tabular mt-0.5 font-medium text-white">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={mono ? "truncate pl-4 font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}
