import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { PlatformStats } from "@/types";

const apiMock = vi.hoisted(() => ({
  isApiConfigured: vi.fn<() => boolean>(),
  fetchPlatformStats: vi.fn<() => Promise<PlatformStats | null>>(),
}));

vi.mock("@/lib/api", () => apiMock);

import LandingPage from "./page";

const STATS: PlatformStats = {
  totalStreams: 1234,
  totalActiveStreams: 56,
  totalStreamedBaseUnits: "9876543210",
  totalValueLockedBaseUnits: "0",
};

describe("LandingPage", () => {
  beforeEach(() => {
    apiMock.isApiConfigured.mockReset().mockReturnValue(true);
    apiMock.fetchPlatformStats.mockReset().mockResolvedValue(STATS);
  });

  it("renders the hero heading and intro copy", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /stream payments by the second on stellar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/built on stellar/i)).toBeInTheDocument();
  });

  it("renders the live demo, labelled as a simulation with no wallet", () => {
    render(<LandingPage />);

    expect(screen.getByText("Demo salary stream")).toBeInTheDocument();
    expect(screen.getByText(/simulated, no wallet needed/i)).toBeInTheDocument();
  });

  it("renders the platform stats from the API once they resolve", async () => {
    render(<LandingPage />);

    const section = screen.getByRole("heading", { name: "Platform activity" }).closest("section");
    expect(section).not.toBeNull();

    await waitFor(() => {
      expect(within(section!).getByText("1,234")).toBeInTheDocument();
    });
    expect(within(section!).getByText("56")).toBeInTheDocument();
    expect(within(section!).getByText("9,876,543,210")).toBeInTheDocument();
    expect(apiMock.fetchPlatformStats).toHaveBeenCalledTimes(1);
  });

  it("shows an honest unavailable message instead of numbers when the API is not configured", async () => {
    apiMock.isApiConfigured.mockReturnValue(false);
    apiMock.fetchPlatformStats.mockResolvedValue(null);

    render(<LandingPage />);

    expect(
      await screen.findByText(/platform stats will appear here once the stellar stream hive api is deployed/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("1,234")).not.toBeInTheDocument();
  });

  it("shows a temporarily-unavailable message when the API is configured but returns nothing", async () => {
    apiMock.fetchPlatformStats.mockResolvedValue(null);

    render(<LandingPage />);

    expect(await screen.findByText("Platform stats are temporarily unavailable.")).toBeInTheDocument();
  });

  it("links the primary calls to action to their pages", () => {
    render(<LandingPage />);

    // "Create a Stream" appears in both the hero and the closing call to action.
    const createLinks = screen.getAllByRole("link", { name: "Create a Stream" });
    expect(createLinks).toHaveLength(2);
    for (const link of createLinks) {
      expect(link).toHaveAttribute("href", "/streams/new");
    }
    expect(screen.getByRole("link", { name: "View My Streams" })).toHaveAttribute("href", "/receiving");
    expect(screen.getByRole("link", { name: "My Sending Streams" })).toHaveAttribute("href", "/sending");
  });

  it("renders the how-it-works steps and the FAQ", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    for (const step of ["Create", "Accrue", "Withdraw"]) {
      expect(screen.getByRole("heading", { name: step, level: 3 })).toBeInTheDocument();
    }
    expect(screen.getByText("What is a cliff?")).toBeInTheDocument();
    expect(screen.getByText("Where are the funds held?")).toBeInTheDocument();
  });
});
