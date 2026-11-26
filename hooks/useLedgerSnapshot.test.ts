import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchLatestLedgerSnapshotMock = vi.fn();

vi.mock("@/lib/stellar", () => ({
  fetchLatestLedgerSnapshot: (...args: unknown[]) => fetchLatestLedgerSnapshotMock(...args),
}));

import { RESYNC_MS, useLedgerSnapshot } from "./useLedgerSnapshot";

/** Lets pending promise callbacks (the mocked fetch and the state updates after it) run. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useLedgerSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchLatestLedgerSnapshotMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is loading until the first fetch resolves, then exposes the snapshot fields", async () => {
    fetchLatestLedgerSnapshotMock.mockResolvedValue(1000);

    const { result } = renderHook(() => useLedgerSnapshot());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.reference).toBeNull();
    expect(result.current.lastSyncedAt).toBeNull();

    await flush();

    expect(result.current.reference).toBe(1000);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastSyncedAt).not.toBeNull();
    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("re-syncs after RESYNC_MS", async () => {
    fetchLatestLedgerSnapshotMock.mockResolvedValueOnce(1000).mockResolvedValueOnce(1006);

    const { result } = renderHook(() => useLedgerSnapshot());
    await flush();
    expect(result.current.reference).toBe(1000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESYNC_MS);
    });

    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(2);
    expect(result.current.reference).toBe(1006);
  });

  it("does not re-sync before RESYNC_MS has elapsed", async () => {
    fetchLatestLedgerSnapshotMock.mockResolvedValue(1000);

    renderHook(() => useLedgerSnapshot());
    await flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESYNC_MS - 1);
    });

    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("stops the interval on unmount", async () => {
    fetchLatestLedgerSnapshotMock.mockResolvedValue(1000);

    const { unmount } = renderHook(() => useLedgerSnapshot());
    await flush();
    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESYNC_MS * 3);
    });

    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("performs one fetch and no interval when disabled", async () => {
    fetchLatestLedgerSnapshotMock.mockResolvedValue(1000);

    const { result } = renderHook(() => useLedgerSnapshot({ enabled: false }));
    await flush();

    expect(result.current.reference).toBe(1000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESYNC_MS * 3);
    });

    expect(fetchLatestLedgerSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("reports a fetch error and stops loading", async () => {
    fetchLatestLedgerSnapshotMock.mockRejectedValue(new Error("rpc down"));

    const { result } = renderHook(() => useLedgerSnapshot());
    await flush();

    expect(result.current.error?.message).toBe("rpc down");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reference).toBeNull();
  });

  it("uses a simulated reference without touching the network", async () => {
    const { result } = renderHook(() => useLedgerSnapshot({ simulatedReference: 4242 }));
    await flush();

    expect(result.current.reference).toBe(4242);
    expect(result.current.isLoading).toBe(false);
    expect(fetchLatestLedgerSnapshotMock).not.toHaveBeenCalled();
  });
});
