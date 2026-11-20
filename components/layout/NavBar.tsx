"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { NetworkBadge } from "@/components/wallet/NetworkBadge";

const LINKS = [
  { href: "/streams/new", label: "Create Stream" },
  { href: "/sending", label: "Sending" },
  { href: "/receiving", label: "Receiving" },
];

const MOBILE_MENU_ID = "mobile-nav-menu";

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={() => setMobileOpen(false)}>
          <HiveLogo />
          <span className="hidden sm:inline">Stellar Stream Hive</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === link.href ? "bg-surface text-white" : "text-muted hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <NetworkBadge />
          <ConnectButton />
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg border border-border p-2 text-muted hover:text-white md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_MENU_ID}
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id={MOBILE_MENU_ID} className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === link.href ? "bg-surface text-white" : "text-muted hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function HiveLogo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M12 2 20 6.5v9L12 20 4 15.5v-9L12 2Z" />
      <path d="M12 8 16 10v4l-4 2-4-2v-4l4-2Z" />
    </svg>
  );
}
