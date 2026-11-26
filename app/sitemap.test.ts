import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("uses the configured site URL as the base for every entry", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://stream-hive.example";
    const entries = sitemap();

    expect(entries.map((e) => e.url)).toEqual([
      "https://stream-hive.example",
      "https://stream-hive.example/streams/new",
    ]);
  });

  it("falls back to localhost when the site URL is not configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const entries = sitemap();

    expect(entries.map((e) => e.url)).toEqual(["http://localhost:3000", "http://localhost:3000/streams/new"]);
  });

  it("only lists routes that exist under app/", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://stream-hive.example";
    const entries = sitemap();

    for (const entry of entries) {
      const route = new URL(entry.url).pathname;
      const pagePath = route === "/" ? "app/page.tsx" : path.join("app", route, "page.tsx");
      expect(existsSync(path.join(process.cwd(), pagePath))).toBe(true);
    }
  });
});
