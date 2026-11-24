"use client";

import { useState } from "react";
import { LiveBalance } from "@/components/stream/LiveBalance";
import { StreamProgress } from "@/components/stream/StreamProgress";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";
import type { LedgerSnapshot } from "@/lib/stellar";
import { formatNumber } from "@/lib/format";

const DEMO_TOTAL_XLM = 10_000;
const DEMO_TOTAL_BASE_UNITS = (BigInt(DEMO_TOTAL_XLM) * 10_000_000n).toString(); // 7-decimal fixed point
const DEMO_DURATION_DAYS = 30;
const DEMO_ELAPSED_DAYS = 4.5; // how far "into" the demo stream we start, purely for a compelling initial view
const DEMO_REFERENCE_LEDGER = 1_000_000;

/**
 * A purely client-side, no-wallet-required simulation of a stream accruing,
 * used on the landing page to demonstrate the product's signature feel. This
 * is clearly labeled as a demo and never touches the network or real data.
 */
export function LiveDemo() {
  const [reference] = useState<LedgerSnapshot>(() => ({
    ledger: DEMO_REFERENCE_LEDGER,
    timestampMs: Date.now(),
  }));

  const elapsedLedgers = Math.floor((DEMO_ELAPSED_DAYS * 86400) / AVERAGE_LEDGER_SECONDS);
  const totalDurationLedgers = Math.floor((DEMO_DURATION_DAYS * 86400) / AVERAGE_LEDGER_SECONDS);
  const startLedger = reference.ledger - elapsedLedgers;
  const endLedger = startLedger + totalDurationLedgers;

  return (
    <div className="card border-accent/20 bg-gradient-to-br from-surface to-accent/5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Demo salary stream</p>
          <p className="text-xs text-muted">
            {formatNumber(DEMO_TOTAL_XLM)} XLM over {DEMO_DURATION_DAYS} days · simulated, no wallet needed
          </p>
        </div>
      </div>

      <LiveBalance
        totalAmount={DEMO_TOTAL_BASE_UNITS}
        withdrawnAmount="0"
        startLedger={startLedger}
        endLedger={endLedger}
        tokenSymbol="XLM"
        simulatedReference={reference}
        label="Accrued so far"
      />

      <div className="mt-6">
        <StreamProgress
          totalAmount={DEMO_TOTAL_BASE_UNITS}
          withdrawnAmount="0"
          startLedger={startLedger}
          endLedger={endLedger}
          tokenSymbol="XLM"
          simulatedReference={reference}
        />
      </div>
    </div>
  );
}
