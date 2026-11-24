import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stream } from "@/types";

import { useStream } from "./useStream";

const fetchStreamByIdMock = vi.fn();
const fetchStreamOnChainMock = vi.fn();
const isStreamContractConfiguredMock = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchStreamById: (...args: unknown[]) => fetchStreamByIdMock(...args),
}));

vi.mock("@/lib/contracts", () => ({
  fetchStreamOnChain: (...args: unknown[]) => fetchStreamOnChainMock(...args),
  isStreamContractConfigured: () => isStreamContractConfiguredMock(),
}));

function makeStream(id: string): Stream {
  return {
    id,
    sender: "GSENDER",
    recipient: "GRECIPIENT",
    token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
    totalAmount: "1000",
    withdrawnAmount: "0",
    startLedger: 1,
    endLedger: 100,
    startTime: 0,
    endTime: 1,
    cancellable: true,
    status: "active",
  };
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useStream", () => {
  beforeEach(() => {
    fetchStreamByIdMock.mockReset();
    fetchStreamOnChainMock.mockReset();
    isStreamContractConfiguredMock.mockReset();
    isStreamContractConfiguredMock.mockReturnValue(true);
  });

  it("starts loading and then returns the stream from the API", async () => {
    const stream = makeStream("1");
    fetchStreamByIdMock.mockResolvedValue(stream);

    const { result } = renderHook(() => useStream("1"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.stream).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stream).toEqual(stream);
    expect(result.current.error).toBeNull();
    expect(result.current.notConfigured).toBe(false);
    expect(fetchStreamByIdMock).toHaveBeenCalledWith("1");
    expect(fetchStreamOnChainMock).not.toHaveBeenCalled();
  });

  it("reports an error when the API request fails", async () => {
    fetchStreamByIdMock.mockRejectedValue(new Error("indexer unavailable"));

    const { result } = renderHook(() => useStream("1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("indexer unavailable");
    expect(result.current.stream).toBeNull();
  });

  it("falls back to an on-chain read when the API does not know the stream", async () => {
    const onChain = makeStream("7");
    fetchStreamByIdMock.mockResolvedValue(null);
    fetchStreamOnChainMock.mockResolvedValue(onChain);

    const { result } = renderHook(() => useStream("7"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchStreamOnChainMock).toHaveBeenCalledWith("7");
    expect(result.current.stream).toEqual(onChain);
    expect(result.current.error).toBeNull();
  });

  it("reports 'not found' when neither the API nor the chain has the stream", async () => {
    fetchStreamByIdMock.mockResolvedValue(null);
    fetchStreamOnChainMock.mockResolvedValue(null);

    const { result } = renderHook(() => useStream("404"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Stream not found.");
    expect(result.current.stream).toBeNull();
  });

  it("flags notConfigured, without an error, when the contract is not configured", async () => {
    fetchStreamByIdMock.mockResolvedValue(null);
    isStreamContractConfiguredMock.mockReturnValue(false);

    const { result } = renderHook(() => useStream("1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notConfigured).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.stream).toBeNull();
    expect(fetchStreamOnChainMock).not.toHaveBeenCalled();
  });

  it("ignores an older response that arrives after a newer request", async () => {
    const first = createDeferred<Stream | null>();
    const second = createDeferred<Stream | null>();
    fetchStreamByIdMock.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(({ id }: { id: string }) => useStream(id), {
      initialProps: { id: "old" },
    });

    rerender({ id: "new" });
    await waitFor(() => expect(fetchStreamByIdMock).toHaveBeenCalledTimes(2));

    const newer = makeStream("new");
    await act(async () => {
      second.resolve(newer);
    });
    await waitFor(() => expect(result.current.stream).toEqual(newer));

    // The older request finishes last; it must not overwrite the newer stream.
    await act(async () => {
      first.resolve(makeStream("old"));
    });

    expect(result.current.stream).toEqual(newer);
    expect(result.current.isLoading).toBe(false);
  });

  it("refetch issues a new request", async () => {
    fetchStreamByIdMock.mockResolvedValueOnce(makeStream("1"));
    const { result } = renderHook(() => useStream("1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchStreamByIdMock).toHaveBeenCalledTimes(1);

    const updated = { ...makeStream("1"), withdrawnAmount: "250" };
    fetchStreamByIdMock.mockResolvedValueOnce(updated);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchStreamByIdMock).toHaveBeenCalledTimes(2);
    expect(result.current.stream).toEqual(updated);
  });
});
