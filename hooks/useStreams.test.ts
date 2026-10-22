import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStreams } from "./useStreams";

const fetchStreamsMock = vi.fn();

vi.mock("../lib/streams", () => ({
  fetchStreams: (...args: unknown[]) => fetchStreamsMock(...args),
}));

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

describe("useStreams", () => {
  beforeEach(() => {
    fetchStreamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ignores stale responses that resolve after a newer request", async () => {
    const first = createDeferred<unknown[]>();
    const second = createDeferred<unknown[]>();

    fetchStreamsMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ address }: { address: string }) => useStreams(address),
      { initialProps: { address: "GADDRESS_ONE" } },
    );

    // Trigger a second request by changing the address while the first is in flight.
    rerender({ address: "GADDRESS_TWO" });

    await waitFor(() => {
      expect(fetchStreamsMock).toHaveBeenCalledTimes(2);
    });

    const newerData = [{ id: "newer" }];
    const staleData = [{ id: "stale" }];

    // Resolve the newer request first, then the stale one out of order.
    second.resolve(newerData);
    await waitFor(() => {
      expect(result.current.streams).toEqual(newerData);
    });

    first.resolve(staleData);

    // Give the stale promise a chance to settle and attempt to set state.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.streams).toEqual(newerData);
  });
});