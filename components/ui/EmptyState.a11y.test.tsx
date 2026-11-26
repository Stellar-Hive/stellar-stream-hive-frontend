import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { EmptyState } from "./EmptyState";

describe("EmptyState accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <EmptyState
        title="No streams yet"
        description="Create your first stream to get started."
        action={<button type="button">Create stream</button>}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
