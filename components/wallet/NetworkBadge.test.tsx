import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";

vi.mock("@/hooks/useWallet", () => ({ useWallet: vi.fn() }));
vi.mock("@/lib/stellar", () => ({ NETWORK: "TESTNET" }));

import { useWallet } from "@/hooks/useWallet";
import { NetworkBadge } from "./NetworkBadge";

function render(overrides: { isConnected?: boolean; network?: string | null } = {}) {
  const isConnected = overrides.isConnected ?? true;
  const network = overrides.network === undefined ? "TESTNET" : overrides.network;
  (useWallet as Mock).mockReturnValue({
    isConnected,
    network,
    isWrongNetwork: isConnected && network !== null && network !== "TESTNET",
  });
  return NetworkBadge();
}

const alerts = (element: ReturnType<typeof NetworkBadge>) =>
  findAll(element, (el) => el.props.role === "alert");

describe("NetworkBadge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when the wallet network matches the app network", () => {
    expect(render({ network: "TESTNET" })).toBeNull();
  });

  it("renders nothing when the wallet is disconnected", () => {
    expect(render({ isConnected: false, network: "PUBLIC" })).toBeNull();
  });

  it("renders nothing when the wallet network is unknown", () => {
    expect(render({ network: null })).toBeNull();
  });

  it("warns when the wallet network does not match the app network", () => {
    const element = render({ network: "PUBLIC" });
    const [alert] = alerts(element);

    expect(alerts(element)).toHaveLength(1);
    expect(textOf(alert)).toContain("Wrong network");
    expect(textOf(alert)).toContain("PUBLIC");
    expect(textOf(alert)).toContain("TESTNET");
  });
});
