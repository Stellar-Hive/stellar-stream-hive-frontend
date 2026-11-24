import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformStats } from "./PlatformStats";

const fetchPlatformStats = vi.hoisted(() => vi.fn());
const isApiConfigured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ fetchPlatformStats, isApiConfigured }));

describe("PlatformStats", () => {
  afterEach(() => {
    fetchPlatformStats.mockReset();
    isApiConfigured.mockReset();
  });

  it("shows a loading spinner before the fetch resolves", () => {
    isApiConfigured.mockReturnValue(true);
    fetchPlatformStats.mockReturnValue(new Promise(() => {})); // never resolves

    render(<PlatformStats />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders the real numbers once the fetch succeeds", async () => {
    isApiConfigured.mockReturnValue(true);
    fetchPlatformStats.mockResolvedValue({
      totalStreams: 42,
      totalActiveStreams: 7,
      totalStreamedBaseUnits: "123456789",
      totalValueLockedBaseUnits: "999",
    });

    render(<PlatformStats />);

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("123,456,789")).toBeInTheDocument();
  });

  it("shows an honest unconfigured message, with no fabricated numbers, when the API is not configured", async () => {
    isApiConfigured.mockReturnValue(false);
    fetchPlatformStats.mockResolvedValue(null);

    render(<PlatformStats />);

    await waitFor(() =>
      expect(
        screen.getByText("Platform stats will appear here once the Stellar Stream Hive API is deployed.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/^\d/)).not.toBeInTheDocument();
  });

  it("shows an honest error message, with no fabricated numbers, when the API is configured but unreachable", async () => {
    isApiConfigured.mockReturnValue(true);
    fetchPlatformStats.mockResolvedValue(null);

    render(<PlatformStats />);

    await waitFor(() =>
      expect(screen.getByText("Platform stats are temporarily unavailable.")).toBeInTheDocument()
    );
    expect(screen.queryByText(/^\d/)).not.toBeInTheDocument();
  });
});
