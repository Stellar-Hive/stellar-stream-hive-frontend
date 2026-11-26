import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useWallet } from "@/hooks/useWallet";
import { WalletProvider, useWalletContext } from "./WalletProvider";

const TestComponent = () => {
  const wallet = useWalletContext();
  return (
    <div>
      <div data-testid="address">{wallet.publicKey || "not connected"}</div>
      <div data-testid="network">{wallet.network || "unknown"}</div>
    </div>
  );
};

describe("WalletProvider - Freighter watching", () => {
  let mockFreighter: any;

  beforeEach(() => {
    mockFreighter = {
      isConnected: vi.fn().mockResolvedValue(false),
      getPublicKey: vi.fn(),
      getNetwork: vi.fn(),
      watchAccount: vi.fn(),
      watchNetwork: vi.fn(),
    };

    Object.defineProperty(window, "freighter", {
      value: mockFreighter,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as any).freighter;
    vi.clearAllMocks();
  });

  it("responds to account changes via watchAccount", async () => {
    const initialAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";
    const newAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBS5H";

    let watchCallback: ((address: string) => void) | null = null;

    mockFreighter.getPublicKey.mockResolvedValue(initialAddress);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount.mockImplementation((cb) => {
      watchCallback = cb;
      return vi.fn();
    });

    const { rerender } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(initialAddress);
    });

    // Simulate account change
    if (watchCallback) {
      watchCallback(newAddress);
    }

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(newAddress);
    });
  });

  it("responds to network changes via watchNetwork", async () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";

    let watchCallback: ((network: string) => void) | null = null;

    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchNetwork.mockImplementation((cb) => {
      watchCallback = cb;
      return vi.fn();
    });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("network")).toHaveTextContent("TESTNET");
    });

    // Simulate network change
    if (watchCallback) {
      watchCallback("PUBLIC");
    }

    await waitFor(() => {
      expect(screen.getByTestId("network")).toHaveTextContent("PUBLIC");
    });
  });

  it("cleans up listeners on unmount", async () => {
    const unsubscribeAccount = vi.fn();
    const unsubscribeNetwork = vi.fn();

    mockFreighter.getPublicKey.mockResolvedValue("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC");
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount.mockReturnValue(unsubscribeAccount);
    mockFreighter.watchNetwork.mockReturnValue(unsubscribeNetwork);

    const { unmount } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(mockFreighter.watchAccount).toHaveBeenCalled();
      expect(mockFreighter.watchNetwork).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribeAccount).toHaveBeenCalled();
      expect(unsubscribeNetwork).toHaveBeenCalled();
    });
  });

  it("falls back to visibilitychange polling when watch API unavailable", async () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";

    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount = undefined;
    mockFreighter.watchNetwork = undefined;

    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    });

    addEventListenerSpy.mockRestore();
  });
});

interface FakeFreighter {
  isConnected?: () => Promise<boolean>;
  requestAccess?: () => Promise<{ address?: string } | string>;
  getPublicKey?: () => Promise<string>;
  getNetwork?: () => Promise<string>;
  watchAccount?: (callback: (address: string) => void) => () => void;
  watchNetwork?: (callback: (network: string) => void) => () => void;
}

function setFreighter(freighter: FakeFreighter | undefined) {
  (window as unknown as { freighter?: FakeFreighter }).freighter = freighter;
}

function Probe() {
  const wallet = useWallet();
  return (
    <div>
      <span data-testid="detecting">{String(wallet.isDetecting)}</span>
      <span data-testid="installed">{String(wallet.isFreighterInstalled)}</span>
      <span data-testid="connected">{String(wallet.isConnected)}</span>
      <span data-testid="address">{wallet.publicKey ?? "none"}</span>
      <span data-testid="network">{wallet.network ?? "none"}</span>
      <span data-testid="wrong-network">{String(wallet.isWrongNetwork)}</span>
      <span data-testid="error">{wallet.error ?? "none"}</span>
      <button type="button" onClick={() => void wallet.connect()}>
        connect
      </button>
      <button type="button" onClick={() => wallet.disconnect()}>
        disconnect
      </button>
    </div>
  );
}

async function renderProvider() {
  render(
    <WalletProvider>
      <Probe />
    </WalletProvider>
  );
  await waitFor(() => expect(screen.getByTestId("detecting")).toHaveTextContent("false"));
}

async function clickConnect() {
  await act(async () => {
    fireEvent.click(screen.getByText("connect"));
  });
}

describe("WalletProvider - connect, disconnect and network flows", () => {
  beforeEach(() => {
    setFreighter(undefined);
  });

  afterEach(() => {
    setFreighter(undefined);
  });

  it("reports Freighter as not installed and refuses to connect", async () => {
    await renderProvider();

    expect(screen.getByTestId("installed")).toHaveTextContent("false");
    expect(screen.getByTestId("connected")).toHaveTextContent("false");

    await clickConnect();

    expect(screen.getByTestId("error")).toHaveTextContent("Freighter wallet is not installed.");
  });

  it("connects and exposes the address and network", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "",
      requestAccess: async () => ({ address: "GCONNECTED" }),
      getNetwork: async () => "TESTNET",
    });
    await renderProvider();
    expect(screen.getByTestId("installed")).toHaveTextContent("true");
    expect(screen.getByTestId("connected")).toHaveTextContent("false");

    await clickConnect();

    await waitFor(() => expect(screen.getByTestId("connected")).toHaveTextContent("true"));
    expect(screen.getByTestId("address")).toHaveTextContent("GCONNECTED");
    expect(screen.getByTestId("network")).toHaveTextContent("TESTNET");
    expect(screen.getByTestId("wrong-network")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("shows the error when access is denied", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "",
      requestAccess: async () => {
        throw new Error("The user rejected this request.");
      },
    });
    await renderProvider();

    await clickConnect();

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("The user rejected this request."));
    expect(screen.getByTestId("connected")).toHaveTextContent("false");
  });

  it("reports an error when Freighter returns no address", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "",
      requestAccess: async () => ({}),
    });
    await renderProvider();

    await clickConnect();

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Unable to retrieve wallet address."));
    expect(screen.getByTestId("connected")).toHaveTextContent("false");
  });

  it("flags a network mismatch when Freighter is on another network", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "",
      requestAccess: async () => ({ address: "GCONNECTED" }),
      getNetwork: async () => "PUBLIC",
    });
    await renderProvider();

    await clickConnect();

    await waitFor(() => expect(screen.getByTestId("connected")).toHaveTextContent("true"));
    expect(screen.getByTestId("network")).toHaveTextContent("PUBLIC");
    expect(screen.getByTestId("wrong-network")).toHaveTextContent("true");
  });

  it("restores an already-connected wallet on load", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "GRESTORED",
      getNetwork: async () => "TESTNET",
    });

    await renderProvider();

    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GRESTORED"));
    expect(screen.getByTestId("connected")).toHaveTextContent("true");
  });

  it("disconnect clears the address, network and error", async () => {
    setFreighter({
      isConnected: async () => true,
      getPublicKey: async () => "",
      requestAccess: async () => ({ address: "GCONNECTED" }),
      getNetwork: async () => "TESTNET",
    });
    await renderProvider();
    await clickConnect();
    await waitFor(() => expect(screen.getByTestId("connected")).toHaveTextContent("true"));

    await act(async () => {
      fireEvent.click(screen.getByText("disconnect"));
    });

    expect(screen.getByTestId("connected")).toHaveTextContent("false");
    expect(screen.getByTestId("address")).toHaveTextContent("none");
    expect(screen.getByTestId("network")).toHaveTextContent("none");
  });
});
