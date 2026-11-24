import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { Stream } from "@/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { StreamCard } from "./StreamCard";

const STREAM: Stream = {
  id: "42",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
  totalAmount: "15000000",
  withdrawnAmount: "15000000",
  startLedger: 100,
  endLedger: 200,
  startTime: 0,
  endTime: 0,
  cancellable: false,
  status: "completed",
};

describe("StreamCard accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<StreamCard stream={STREAM} role="sender" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
