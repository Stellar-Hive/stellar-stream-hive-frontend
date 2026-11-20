// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTDOWN_TICK_MS, StartsInCountdown } from "./StartsInCountdown";

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

describe("StartsInCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the time left and labels it as an estimate", () => {
    render(<StartsInCountdown startTime={NOW + 125 * MIN} />);
    expect(screen.getByText(/Starts in 2h 5m/)).not.toBeNull();
    expect(screen.getByText("(estimated)")).not.toBeNull();
  });

  it("counts down as time passes, without a live region", () => {
    const { container } = render(<StartsInCountdown startTime={NOW + 10 * MIN} />);
    expect(screen.getByText(/Starts in 10m/)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(4 * MIN);
    });

    expect(screen.getByText(/Starts in 6m/)).not.toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("renders nothing once the start time has passed", () => {
    const { container } = render(<StartsInCountdown startTime={NOW + 1 * MIN} />);
    expect(screen.getByText(/Starts in/)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2 * MIN);
    });

    expect(container.textContent).toBe("");
  });

  it("renders nothing for an invalid start time instead of a fabricated value", () => {
    const { container } = render(<StartsInCountdown startTime={Number.NaN} />);
    expect(container.textContent).toBe("");
  });
});
