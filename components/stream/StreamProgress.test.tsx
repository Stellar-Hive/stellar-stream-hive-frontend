import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreamProgress } from "./StreamProgress";

/**
 * Helper to build a simulated ledger reference.
 * `simulatedReference` is the current ledger sequence used by StreamProgress
 * to derive the streamed amount from the stream's start/end ledgers.
 */
function makeReference(ledger: number) {
  return { ledger } as unknown as Parameters<typeof StreamProgress>[0]["simulatedReference"];
}

const baseProps = {
  startLedger: 100,
  endLedger: 200,
  totalAmount: "1000000000", // 10 tokens (7 decimals) as BigInt string
  withdrawnAmount: "0",
  enabled: true,
};

describe("StreamProgress", () => {
  it("renders 0% at the start of the stream", () => {
    render(
      <StreamProgress
        {...baseProps}
        simulatedReference={makeReference(100)}
      />,
    );

    expect(screen.getByText(/0\s*%/)).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    // Stat labels present
    expect(screen.getByText(/streamed/i)).toBeInTheDocument();
    expect(screen.getByText(/withdrawn/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  });

  it("renders mid-stream progress with floored streamed amount", () => {
    render(
      <StreamProgress
        {...baseProps}
        simulatedReference={makeReference(150)}
      />,
    );

    // 50% through the stream
    expect(screen.getByText(/50\s*%/)).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    expect(screen.getByText(/streamed/i)).toBeInTheDocument();
    expect(screen.getByText(/withdrawn/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  });

  it("floors the streamed amount rather than rounding up", () => {
    // Use an amount that does not divide evenly across the ledger range so
    // the streamed value must be floored.
    render(
      <StreamProgress
        {...baseProps}
        totalAmount="1000000001"
        simulatedReference={makeReference(150)}
      />,
    );

    const bar = screen.getByRole("progressbar");
    // Percent is derived from floored streamed amount; must not exceed 50.
    const now = Number(bar.getAttribute("aria-valuenow"));
    expect(now).toBeLessThanOrEqual(50);
    expect(now).toBeGreaterThanOrEqual(0);
  });

  it("renders 100% at the end of the stream", () => {
    render(
      <StreamProgress
        {...baseProps}
        simulatedReference={makeReference(200)}
      />,
    );

    expect(screen.getByText(/100\s*%/)).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    expect(screen.getByText(/streamed/i)).toBeInTheDocument();
    expect(screen.getByText(/withdrawn/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  });

  it("renders 100% when past the end of the stream", () => {
    render(
      <StreamProgress
        {...baseProps}
        simulatedReference={makeReference(250)}
      />,
    );

    expect(screen.getByText(/100\s*%/)).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders cancelled state", () => {
    render(
      <StreamProgress
        {...baseProps}
        cancelled
        simulatedReference={makeReference(150)}
      />,
    );

    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    // Cancelled streams should still expose a valid progressbar value.
    const now = Number(bar.getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(100);
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders pending/loading state when not enabled", () => {
    render(
      <StreamProgress
        {...baseProps}
        enabled={false}
        simulatedReference={makeReference(150)}
      />,
    );

    // Pending state should surface a loading indicator rather than
    // fabricated progress values.
    expect(screen.getByText(/pending|loading/i)).toBeInTheDocument();
  });

  it("renders pending/loading state when no reference is available", () => {
    render(
      <StreamProgress
        {...baseProps}
        simulatedReference={undefined}
      />,
    );

    expect(screen.getByText(/pending|loading/i)).toBeInTheDocument();
  });
});