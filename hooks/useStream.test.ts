import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStreamByIdMock = vi.fn();

vi.mock("../lib/api", () => ({
  fetchStreamById: (...args: unknown[]) => fetchStreamByIdMock(...args),
}));
vi.mock("../lib/contracts", () => ({
  fetchStreamOnChain: vi.fn(),
  isStreamContractConfigured: () => false,
}));

describe("useStream visibility refetch", () => {
  beforeEach(() => {
    fetchStreamByIdMock.mockReset();
  });

  it("refetches on visibilitychange once visible again after being stale", async () => {
    const first = { id: "s1" };
    const refetched = { id: "s1", status: "completed" };
    fetchStreamByIdMock.mockResolvedValueOnce(first).mockResolvedValueOnce(refetched);

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const { useStream } = await import("./useStream");
    const { result } = renderHook(() => useStream("s1"));

    await waitFor(() => expect(result.current.stream).toEqual(first));

    nowSpy.mockReturnValue(31_000);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(result.current.stream).toEqual(refetched));
    expect(fetchStreamByIdMock).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("does not refetch while the tab is hidden", async () => {
    const first = { id: "s1" };
    fetchStreamByIdMock.mockResolvedValueOnce(first);

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const { useStream } = await import("./useStream");
    const { result } = renderHook(() => useStream("s1"));

    await waitFor(() => expect(result.current.stream).toEqual(first));

    nowSpy.mockReturnValue(31_000);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchStreamByIdMock).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
