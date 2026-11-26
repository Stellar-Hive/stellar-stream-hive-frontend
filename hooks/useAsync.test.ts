import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAsync } from "@/hooks/useAsync";

describe("useAsync", () => {
  it("loads data and sets isLoading and error correctly", async () => {
    const loadFn = vi.fn(async () => "test data");

    const { result } = renderHook(() => useAsync(loadFn, []));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe("test data");
    expect(result.current.error).toBe(null);
  });

  it("handles errors and updates error state", async () => {
    const testError = new Error("Test error");
    const loadFn = vi.fn(async () => {
      throw testError;
    });

    const { result } = renderHook(() => useAsync(loadFn, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Test error");
  });

  it("ignores stale responses", async () => {
    let stale = false;
    const loadFn = vi.fn(async (isStale: () => boolean) => {
      if (isStale()) return null;
      stale = true;
      return "stale data";
    });

    const { result } = renderHook(() => useAsync(loadFn, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe("stale data");
  });

  it("supports custom error handler", async () => {
    const loadFn = vi.fn(async () => {
      throw new Error("Test error");
    });

    const { result } = renderHook(() =>
      useAsync(loadFn, [], {
        onError: () => "Custom error message",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Custom error message");
  });
});
