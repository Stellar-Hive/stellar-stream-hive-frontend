import { describe, expect, it, vi } from "vitest";
import { shortenAddress } from "@/lib/format";
import { findAll, textOf } from "@/lib/testing/elementTree";
import type { Stream } from "@/types";

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

import Link from "next/link";
import { CopyButton } from "@/components/ui/CopyButton";
import { LiveBalance } from "./LiveBalance";
import { StreamCard } from "./StreamCard";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const STREAM: Stream = {
  id: "42",
  sender: SENDER,
  recipient: RECIPIENT,
  token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
  totalAmount: "15000000",
  withdrawnAmount: "5000000",
  startLedger: 100,
  endLedger: 200,
  startTime: 0,
  endTime: 0,
  cancellable: true,
  status: "active",
};

describe("StreamCard", () => {
  describe("as the sender", () => {
    const element = StreamCard({ stream: STREAM, role: "sender" });

    it("shows the recipient as the counterpart", () => {
      const text = textOf(element);
      expect(text).toContain("Recipient");
      expect(text).toContain(shortenAddress(RECIPIENT));
      expect(text).not.toContain(shortenAddress(SENDER));
    });

    it("lets the sender copy the recipient address", () => {
      const [copy] = findAll(element, (el) => el.type === CopyButton);
      expect(copy.props.value).toBe(RECIPIENT);
    });

    it("shows the total commitment instead of a live balance", () => {
      expect(textOf(element)).toContain("Total commitment");
      expect(findAll(element, (el) => el.type === LiveBalance)).toHaveLength(0);
    });
  });

  describe("as the recipient", () => {
    const element = StreamCard({ stream: STREAM, role: "recipient" });

    it("shows the sender as the counterpart", () => {
      const text = textOf(element);
      expect(text).toContain("Sender");
      expect(text).toContain(shortenAddress(SENDER));
    });

    it("lets the recipient copy the sender address", () => {
      const [copy] = findAll(element, (el) => el.type === CopyButton);
      expect(copy.props.value).toBe(SENDER);
    });

    it("shows a live withdrawable balance for an active stream", () => {
      const [balance] = findAll(element, (el) => el.type === LiveBalance);
      expect(balance.props.label).toBe("Withdrawable");
      expect(balance.props.enabled).toBe(true);
      expect(balance.props.tokenSymbol).toBe("XLM");
    });

    it("freezes the live balance for a completed stream", () => {
      const completed = StreamCard({ stream: { ...STREAM, status: "completed" }, role: "recipient" });
      const [balance] = findAll(completed, (el) => el.type === LiveBalance);
      expect(balance.props.enabled).toBe(false);
    });
  });

  it("links to the stream detail page and renders the provided actions", () => {
    const element = StreamCard({ stream: STREAM, role: "sender", actions: <span>Cancel stream</span> });
    const [link] = findAll(element, (el) => el.type === Link);

    expect(link.props.href).toBe("/streams/42");
    expect(textOf(element)).toContain("Cancel stream");
  });
});
