import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";
import { LiveDemo } from "./LiveDemo";

const LEDGER_MS = AVERAGE_LEDGER_SECONDS * 1_000;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

function readBalance(): number {
  const group = screen.getByRole("group", { name: /Accrued so far/ });
  const amount = group.querySelector(".mono-tabular");
  const text = amount?.textContent ?? "";
  return Number(text.replace(/,/g, "").replace(/\s*XLM\s*$/, ""));
}

describe("LiveDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels the balance as a simulated demo, not a real wallet", () => {
    render(<LiveDemo />);
    expect(screen.getByText(/simulated, no wallet needed/)).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /Accrued so far/ });
    expect(group.textContent).toContain("Demo");
  });

  it("ticks the balance up as time passes, without exceeding the total", () => {
    render(<LiveDemo />);

    const initial = readBalance();
    expect(initial).toBeGreaterThan(0);
    expect(initial).toBeLessThan(10_000);

    act(() => {
      vi.advanceTimersByTime(LEDGER_MS * 100);
    });

    const afterTick = readBalance();
    expect(afterTick).toBeGreaterThan(initial);
    expect(afterTick).toBeLessThanOrEqual(10_000);
  });

  it("never reports more than the demo total once the simulated stream has fully elapsed", () => {
    render(<LiveDemo />);

    act(() => {
      vi.advanceTimersByTime(LEDGER_MS * 1_000_000);
    });

    expect(readBalance()).toBe(10_000);
  });
});
