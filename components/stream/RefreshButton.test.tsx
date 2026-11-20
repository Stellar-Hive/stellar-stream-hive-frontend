// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshButton, UPDATED_LABEL_TICK_MS } from "./RefreshButton";

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

function labelText(container: HTMLElement): string | null {
  return container.querySelector("span.text-xs")?.textContent ?? null;
}

describe("RefreshButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no freshness label before any successful fetch", () => {
    const { container } = render(<RefreshButton onRefresh={() => {}} isLoading={false} lastUpdatedAt={null} />);
    expect(labelText(container)).toBeNull();
  });

  it("shows how old the data is, and ages it over time", () => {
    const lastUpdatedAt = T0 - 30_000;
    const { container } = render(
      <RefreshButton onRefresh={() => {}} isLoading={false} lastUpdatedAt={lastUpdatedAt} />,
    );
    expect(labelText(container)).toBe("Updated 30s ago");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(labelText(container)).toBe("Updated 1m ago");
  });

  it("updates politely, on a coarse tick rather than every second", () => {
    const { container } = render(
      <RefreshButton onRefresh={() => {}} isLoading={false} lastUpdatedAt={T0} />,
    );
    expect(labelText(container)).toBe("Updated just now");

    act(() => {
      vi.advanceTimersByTime(UPDATED_LABEL_TICK_MS - 1);
    });
    expect(labelText(container)).toBe("Updated just now");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(labelText(container)).toBe("Updated 15s ago");
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("still calls onRefresh and disables while loading", () => {
    const onRefresh = vi.fn();
    const { container, rerender } = render(<RefreshButton onRefresh={onRefresh} isLoading={false} />);
    (container.querySelector("button") as HTMLButtonElement).click();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<RefreshButton onRefresh={onRefresh} isLoading />);
    expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
