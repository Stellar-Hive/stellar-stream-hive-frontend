"use client";

import { useState } from "react";

interface CopyButtonProps {
  /**
   * Text to copy. A function is resolved at click time, which is needed for
   * values only known in the browser (e.g. `() => window.location.href`).
   */
  value: string | (() => string);
  label?: string;
  className?: string;
}

/**
 * A small button that copies `value` to the clipboard and shows a brief "Copied" confirmation.
 * Pass `label="Copy link"` to use it for sharing a URL (e.g. `window.location.href`).
 */
export function CopyButton({ value, label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions). Fail silently —
      // this is a convenience action, not a critical path.
    }
  }

  return (
    <span className="inline-flex">
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted transition hover:bg-surface-hover hover:text-white ${className}`}
        aria-label={label === "Copy" ? "Copy to clipboard" : label}
      >
        {copied ? (
          <>
            <CheckIcon /> Copied
          </>
        ) : (
          <>
            <CopyIcon /> {label}
          </>
        )}
      </button>
      {/* Announces the result to screen readers; the visible label alone is not announced on change. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
