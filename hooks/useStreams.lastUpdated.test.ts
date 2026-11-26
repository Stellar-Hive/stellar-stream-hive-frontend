// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStreams } from "./useStreams";

const fetchBySender = vi.fn();
const fetchByRecipient = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchStreamsBySender: (...args: unknown[]) => fetchBySender(...args),
  fetchStreamsByRecipient: (...args: unknown[]) => fetchByRecipient(...args),
  isApiConfigured: () => true,
}));

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

describe("useStreams lastUpdatedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    fetchBySender.mockReset();
    fetchByRecipient.mockReset();
  });

  it("is null until the first successful fetch", async () => {
    fetchBySender.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useStreams("GADDR", "sender"));
    expect(result.current.lastUpdatedAt).toBeNull();
  });

  it("records the time of the last successful fetch", async () => {
    fetchBySender.mockResolvedValue([]);
    const { result } = renderHook(() => useStreams("GADDR", "sender"));

    await waitFor(() => expect(result.current.lastUpdatedAt).toBe(T0));

    vi.setSystemTime(T0 + 30_000);
    fetchBySender.mockResolvedValue([{ id: "1" }]);
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.lastUpdatedAt).toBe(T0 + 30_000);
  });

  it("keeps the previous timestamp when a refresh fails", async () => {
    fetchBySender.mockResolvedValue([]);
    const { result } = renderHook(() => useStreams("GADDR", "sender"));
    await waitFor(() => expect(result.current.lastUpdatedAt).toBe(T0));

    vi.setSystemTime(T0 + 60_000);
    fetchBySender.mockRejectedValue(new Error("indexer down"));
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBe("indexer down");
    expect(result.current.lastUpdatedAt).toBe(T0);
  });

  it("resets when the address changes, since it is a different list", async () => {
    fetchBySender.mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ address }: { address: string }) => useStreams(address, "sender"),
      { initialProps: { address: "GONE" } },
    );
    await waitFor(() => expect(result.current.lastUpdatedAt).toBe(T0));

    fetchBySender.mockReturnValue(new Promise(() => {}));
    rerender({ address: "GNEW" });

    expect(result.current.lastUpdatedAt).toBeNull();
  });
});
