import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatTimeUntil } from "./format";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

describe("formatTimeUntil", () => {
  it("returns null when the target is not in the future", () => {
    expect(formatTimeUntil(NOW, NOW)).toBeNull();
    expect(formatTimeUntil(NOW - MIN, NOW)).toBeNull();
  });

  it("returns null for invalid timestamps instead of a fabricated countdown", () => {
    expect(formatTimeUntil(Number.NaN, NOW)).toBeNull();
    expect(formatTimeUntil(NOW + MIN, Number.NaN)).toBeNull();
    expect(formatTimeUntil(Number.POSITIVE_INFINITY, NOW)).toBeNull();
  });

  it("describes sub-minute remainders", () => {
    expect(formatTimeUntil(NOW + 1, NOW)).toBe("less than a minute");
    expect(formatTimeUntil(NOW + 59_999, NOW)).toBe("less than a minute");
  });

  it("floors minutes, hours and days rather than rounding up", () => {
    expect(formatTimeUntil(NOW + 4 * MIN + 59_000, NOW)).toBe("4m");
    expect(formatTimeUntil(NOW + 5 * HOUR + 12 * MIN + 30_000, NOW)).toBe("5h 12m");
    expect(formatTimeUntil(NOW + 3 * DAY + 4 * HOUR + 59 * MIN, NOW)).toBe("3d 4h");
  });
});

describe("formatTimeAgo", () => {
  it("reads as just now for very recent or future times", () => {
    expect(formatTimeAgo(NOW, NOW)).toBe("just now");
    expect(formatTimeAgo(NOW, NOW - 2000)).toBe("just now");
    expect(formatTimeAgo(NOW + 10_000, NOW)).toBe("just now");
  });

  it("uses seconds, minutes, hours and days", () => {
    expect(formatTimeAgo(NOW - 30_000, NOW)).toBe("30s ago");
    expect(formatTimeAgo(NOW - 5 * MIN - 20_000, NOW)).toBe("5m ago");
    expect(formatTimeAgo(NOW - 2 * HOUR - 59 * MIN, NOW)).toBe("2h ago");
    expect(formatTimeAgo(NOW - 3 * DAY, NOW)).toBe("3d ago");
  });

  it("handles invalid timestamps without throwing", () => {
    expect(formatTimeAgo(Number.NaN, NOW)).toBe("just now");
  });
});
