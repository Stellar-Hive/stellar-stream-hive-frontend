import { afterEach, describe, expect, it, vi } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";
import { Footer } from "./Footer";

const INTERNAL_ROUTES = new Set(["/", "/sending", "/receiving"]);

describe("Footer links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives every external link rel=noopener noreferrer, target=_blank and a new-tab hint", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", "https://docs.example.com");
    vi.stubEnv("NEXT_PUBLIC_STREAM_CONTRACT_ID", "CSTREAMCONTRACTID");

    const tree = Footer();
    const externalLinks = findAll(tree, (el) => el.type === "a" && String(el.props.href).startsWith("http"));

    expect(externalLinks.length).toBeGreaterThan(0);
    for (const link of externalLinks) {
      expect(link.props.rel).toBe("noopener noreferrer");
      expect(link.props.target).toBe("_blank");
      expect(textOf(link)).toMatch(/opens in a new tab/i);
    }
  });

  it("points every internal link at a route that exists", () => {
    const tree = Footer();
    const internalLinks = findAll(
      tree,
      (el) => el.type === "a" && typeof el.props.href === "string" && el.props.href.startsWith("/")
    );

    for (const link of internalLinks) {
      expect(INTERNAL_ROUTES.has(link.props.href as string)).toBe(true);
    }
  });

  it("only shows the docs link when NEXT_PUBLIC_DOCS_URL is configured", () => {
    const tree = Footer();
    const docsLinks = findAll(tree, (el) => el.type === "a" && textOf(el).startsWith("Docs"));
    expect(docsLinks).toHaveLength(0);
  });

  it("shows the docs link pointing at the configured URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", "https://docs.example.com");

    const tree = Footer();
    const [docsLink] = findAll(tree, (el) => el.type === "a" && textOf(el).startsWith("Docs"));

    expect(docsLink).toBeDefined();
    expect(docsLink.props.href).toBe("https://docs.example.com");
  });
});
