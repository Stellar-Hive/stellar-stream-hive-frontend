import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { WalletContext, type WalletContextValue } from "@/components/wallet/WalletProvider";

const PUBLIC_KEY = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";

function makeWallet(overrides: Partial<WalletContextValue> = {}): WalletContextValue {
  return {
    isConnected: false,
    publicKey: null,
    network: null,
    isFreighterInstalled: true,
    isConnecting: false,
    isDetecting: false,
    error: null,
    isWrongNetwork: false,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function renderWithWallet(wallet: WalletContextValue) {
  return render(
    <WalletContext.Provider value={wallet}>
      <ConnectButton />
    </WalletContext.Provider>,
  );
}

describe("ConnectButton", () => {
  it("shows a disabled detecting state while probing for Freighter", () => {
    renderWithWallet(makeWallet({ isDetecting: true }));

    const button = screen.getByRole("button", { name: "Detecting Freighter wallet" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Checking wallet…");
  });

  it("shows an install link when Freighter is not installed", () => {
    renderWithWallet(makeWallet({ isFreighterInstalled: false }));

    const link = screen.getByRole("link", { name: /Install Freighter/ });
    expect(link).toHaveAttribute("href", "https://www.freighter.app/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
  });

  it("shows the connect label and calls connect on click", () => {
    const wallet = makeWallet();
    renderWithWallet(wallet);

    const button = screen.getByRole("button", { name: "Connect Wallet" });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(wallet.connect).toHaveBeenCalledTimes(1);
  });

  it("shows a disabled connecting state and does not call connect again", () => {
    const wallet = makeWallet({ isConnecting: true });
    renderWithWallet(wallet);

    const button = screen.getByRole("button", { name: /Connecting…/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Connecting…");

    fireEvent.click(button);
    expect(wallet.connect).not.toHaveBeenCalled();
  });

  it("surfaces connection errors inline", () => {
    renderWithWallet(makeWallet({ error: "User rejected the request" }));

    expect(screen.getByText("User rejected the request")).toBeInTheDocument();
  });

  it("shows the shortened address and opens the connected menu", () => {
    const wallet = makeWallet({
      isConnected: true,
      publicKey: PUBLIC_KEY,
      network: "TESTNET",
    });
    renderWithWallet(wallet);

    const trigger = screen.getByRole("button", { name: /GABC…STUV/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText("TESTNET")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("disconnects and closes the menu from the menu item", () => {
    const wallet = makeWallet({
      isConnected: true,
      publicKey: PUBLIC_KEY,
      network: "TESTNET",
    });
    renderWithWallet(wallet);

    fireEvent.click(screen.getByRole("button", { name: /GABC…STUV/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));

    expect(wallet.disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on Escape", () => {
    renderWithWallet(
      makeWallet({ isConnected: true, publicKey: PUBLIC_KEY, network: "TESTNET" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /GABC…STUV/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("falls back to an unknown network label when the network is missing", () => {
    renderWithWallet(makeWallet({ isConnected: true, publicKey: PUBLIC_KEY, network: null }));

    fireEvent.click(screen.getByRole("button", { name: /GABC…STUV/ }));
    expect(screen.getByText("Unknown network")).toBeInTheDocument();
  });
});
