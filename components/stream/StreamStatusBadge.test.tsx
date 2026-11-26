import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreamStatusBadge } from "./StreamStatusBadge";
import type { StreamStatus } from "@/types";

const cases: Array<{ status: StreamStatus; label: string }> = [
  { status: "scheduled", label: "Scheduled" },
  { status: "active", label: "Active" },
  { status: "cliff", label: "Cliff" },
  { status: "completed", label: "Completed" },
  { status: "cancelled", label: "Cancelled" },
];

describe("StreamStatusBadge", () => {
  it.each(cases)("renders the $status label", ({ status, label }) => {
    render(<StreamStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(cases)("shows the pulse indicator only for active ($status)", ({ status }) => {
    const { container } = render(<StreamStatusBadge status={status} />);
    const pulse = container.querySelector("[data-testid='status-pulse']");
    if (status === "active") {
      expect(pulse).not.toBeNull();
    } else {
      expect(pulse).toBeNull();
    }
  });
});
