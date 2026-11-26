import { describe, expect, it } from "vitest";
import { textOf } from "@/lib/testing/elementTree";
import { MAIN_CONTENT_ID, SkipLink } from "./SkipLink";

describe("SkipLink", () => {
  const element = SkipLink();

  it("is an anchor that jumps to the main content landmark", () => {
    expect(element.type).toBe("a");
    expect(element.props.href).toBe(`#${MAIN_CONTENT_ID}`);
  });

  it("is labelled 'Skip to content'", () => {
    expect(textOf(element)).toBe("Skip to content");
  });

  it("is visually hidden until it receives keyboard focus", () => {
    const classes = String(element.props.className).split(" ");
    expect(classes).toContain("sr-only");
    expect(classes).toContain("focus:not-sr-only");
  });
});
