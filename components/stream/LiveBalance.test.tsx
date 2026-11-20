import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveBalance } from "@/components/stream/LiveBalance";

vi.mock("@/hooks/useLiveBalance", () => ({
  useLiveBalance: () => ({
    withdrawable: 1_000_000n,
    streamed: 1_000_000n,
    progress: 0.5,
    isLoading: false,
    error: null,
    lastSyncedAt: null,
  }),
}));

describe("LiveBalance accessibility", () => {
  it("provides a static group label without announcing each balance tick", () => {
    const html = renderToStaticMarkup(
      <LiveBalance
        totalAmount="1000000"
        withdrawnAmount="0"
        startLedger={1}
        endLedger={2}
        tokenSymbol="XLM"
        simulatedReference={{ ledger: 1, timestampMs: 0 }}
      />
    );
    const labelId = html.match(/aria-labelledby="([^"]+)"/)?.[1];

    expect(html).toContain('role="group"');
    expect(labelId).toBeDefined();
    expect(html).toContain(`id="${labelId}">Withdrawable now`);
    expect(html).toContain('aria-live="off"');
  });
});
