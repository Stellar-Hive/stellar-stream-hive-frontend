import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ErrorState } from "./ErrorState";

describe("ErrorState accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<ErrorState message="Could not load stream." onRetry={() => {}} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
