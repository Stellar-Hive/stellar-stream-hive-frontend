import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn() };
});

import { useState } from "react";
import { CopyButton } from "./CopyButton";

const setCopied = vi.fn();

function render(copied: boolean, props: { value: string; label?: string }) {
  (useState as Mock).mockReturnValue([copied, setCopied]);
  return CopyButton(props);
}

function button(element: ReturnType<typeof CopyButton>) {
  const [found] = findAll(element, (el) => el.type === "button");
  return found;
}

describe("CopyButton", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    setCopied.mockClear();
    writeText.mockClear();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the label until something has been copied", () => {
    const element = render(false, { value: "GABC", label: "Copy address" });
    expect(textOf(element)).toContain("Copy address");
    expect(textOf(element)).not.toContain("Copied");
  });

  it("copies the value to the clipboard and flags it as copied", async () => {
    const element = render(false, { value: "GABC" });
    await (button(element).props.onClick as () => Promise<void>)();

    expect(writeText).toHaveBeenCalledWith("GABC");
    expect(setCopied).toHaveBeenCalledWith(true);
  });

  it("clears the Copied confirmation after 1.5 seconds", async () => {
    const element = render(false, { value: "GABC" });
    await (button(element).props.onClick as () => Promise<void>)();

    vi.advanceTimersByTime(1_499);
    expect(setCopied).not.toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(1);
    expect(setCopied).toHaveBeenLastCalledWith(false);
  });

  it("renders the Copied confirmation once copied", () => {
    const element = render(true, { value: "GABC" });
    expect(textOf(element)).toContain("Copied");
  });

  it("does nothing when the clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const element = render(false, { value: "GABC" });
    await (button(element).props.onClick as () => Promise<void>)();

    expect(setCopied).not.toHaveBeenCalled();
  });
});
