"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/format";
import { Spinner } from "@/components/ui/Spinner";
import {
  WALLET_DETECTING,
  WALLET_DETECTING_ARIA_LABEL,
  WALLET_NOT_INSTALLED_LINK_TEXT,
  WALLET_NOT_INSTALLED_TITLE,
  WALLET_CONNECTING,
  WALLET_CONNECT_BUTTON,
  WALLET_DISCONNECT_LABEL,
  WALLET_UNKNOWN_NETWORK,
} from "@/lib/messages";

/**
 * Connects/disconnects Freighter and shows the active address once connected.
 * Handles the "Freighter not installed" case with a link to install it, and
 * surfaces connection errors (rejected access, etc.) inline rather than
 * throwing.
 */
export function ConnectButton() {
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      menuRef.current?.focus();
    }
  }, [menuOpen]);

  if (wallet.isDetecting) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label={WALLET_DETECTING_ARIA_LABEL}
        className="btn-secondary text-sm opacity-60"
      >
        <Spinner size="sm" decorative /> {WALLET_DETECTING}
      </button>
    );
  }

  if (!wallet.isFreighterInstalled) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary text-sm"
        title={WALLET_NOT_INSTALLED_TITLE}
      >
        {WALLET_NOT_INSTALLED_LINK_TEXT}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  if (wallet.isConnected && wallet.publicKey) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-secondary text-sm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="h-2 w-2 rounded-full bg-primary" />
          {shortenAddress(wallet.publicKey)}
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-xl outline-none"
          >
            <div className="px-3 py-2 text-xs text-muted">{wallet.network ?? WALLET_UNKNOWN_NETWORK}</div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                wallet.disconnect();
                setMenuOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              {WALLET_DISCONNECT_LABEL}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={wallet.connect} disabled={wallet.isConnecting} className="btn-primary text-sm">
        {wallet.isConnecting ? (
          <>
            <Spinner size="sm" decorative /> {WALLET_CONNECTING}
          </>
        ) : (
          WALLET_CONNECT_BUTTON
        )}
      </button>
      {wallet.error && <span className="max-w-[220px] text-right text-xs text-danger">{wallet.error}</span>}
    </div>
  );
}
