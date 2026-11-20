import { describe, expect, it } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";
import { Footer, SECURITY_MODEL_URL } from "./Footer";

describe("Footer unaudited notice", () => {
  const tree = Footer();
  const notice = findAll(tree, (el) => el.type === "p").find((el) => textOf(el).includes("unaudited"));

  it("states that the contracts are unaudited", () => {
    expect(notice).toBeDefined();
    expect(textOf(notice)).toContain("The smart contracts are unaudited.");
  });

  it("links to the Security Model in a new tab, with safe rel", () => {
    const link = findAll(notice, (el) => el.type === "a")[0];
    expect(link.props.href).toBe(SECURITY_MODEL_URL);
    expect(link.props.target).toBe("_blank");
    expect(link.props.rel).toBe("noopener noreferrer");
  });
});
