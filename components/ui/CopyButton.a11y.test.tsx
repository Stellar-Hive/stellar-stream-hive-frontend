import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn() };
});

import { useState } from "react";
import { CopyButton } from "./CopyButton";

function render(copied: boolean, label?: string) {
  (useState as Mock).mockReturnValue([copied, vi.fn()]);
  const element = CopyButton({ value: "GABC", label });
  const [button] = findAll(element, (el) => el.type === "button");
  const [status] = findAll(element, (el) => el.props.role === "status");
  return { button, status };
}

describe("CopyButton accessibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gives the default button a descriptive accessible name", () => {
    expect(render(false).button.props["aria-label"]).toBe("Copy to clipboard");
  });

  it("keeps a caller-supplied descriptive label as the accessible name", () => {
    expect(render(false, "Copy address").button.props["aria-label"]).toBe("Copy address");
  });

  it("has a polite live region that is empty until something is copied", () => {
    const { status } = render(false);
    expect(status.props["aria-live"]).toBe("polite");
    expect(textOf(status)).toBe("");
  });

  it("announces the copied state to screen readers", () => {
    const { status } = render(true);
    expect(textOf(status)).toBe("Copied to clipboard");
  });
});
