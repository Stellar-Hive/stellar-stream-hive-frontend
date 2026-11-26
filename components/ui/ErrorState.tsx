interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** A consistent error display for failed fetches / rejected transactions / RPC errors. */
export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-10 text-center"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/15 text-danger">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-1">
          Try again
        </button>
      )}
    </div>
  );
}
