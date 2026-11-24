import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { STREAM_SORTS, type StreamFilter } from "@/lib/streamList";
import { StreamFilterBar } from "./StreamFilterBar";

const COUNTS: Record<StreamFilter, number> = { all: 4, live: 2, completed: 1, cancelled: 1 };

describe("StreamFilterBar accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <StreamFilterBar
        value="all"
        onChange={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        sort={STREAM_SORTS[0].value}
        onSortChange={vi.fn()}
        counts={COUNTS}
        exportable={[]}
        exportName="sending"
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
