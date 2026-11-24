interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Set when the spinner sits beside visible text, such as inside a button, so it is not announced twice. */
  decorative?: boolean;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

/** A minimal spinning-ring loading indicator. */
export function Spinner({ size = "md", className = "", decorative = false }: SpinnerProps) {
  const classes = `inline-block animate-spin rounded-full border-primary/25 border-t-primary ${SIZE_MAP[size] ?? "h-6 w-6 border-2"} ${className}`;

  if (decorative) {
    return <span aria-hidden="true" className={classes} />;
  }
  return <span role="status" aria-label="Loading" className={classes} />;
}
