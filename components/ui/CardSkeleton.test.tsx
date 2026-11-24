import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSkeleton, CardSkeletonGrid } from "./CardSkeleton";

describe("CardSkeleton", () => {
  it("hides the decorative placeholder from assistive technology", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([0, 3])("announces loading once for %i requested placeholders", (count) => {
    render(<CardSkeletonGrid count={count} />);
    const status = screen.getByRole("status", { name: "Loading streams" });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(status.children).toHaveLength(count);
    for (const card of status.children) {
      expect(card).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("renders six placeholders by default", () => {
    render(<CardSkeletonGrid />);
    expect(screen.getByRole("status", { name: "Loading streams" }).children).toHaveLength(6);
  });
});
