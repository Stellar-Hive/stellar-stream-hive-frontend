import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("external links", () => {
  const anchors = SCAN_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir))).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(/<a\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => tag.includes('target="_blank"'))
      .map((tag) => ({ file: path.relative(ROOT, file), tag }));
  });

  it("finds the external links the audit should cover", () => {
    expect(anchors.length).toBeGreaterThan(0);
  });

  it.each(anchors.map((a) => [a.file, a.tag]))('%s opens with rel="noopener noreferrer"', (_file, tag) => {
    expect(tag).toMatch(/rel="noopener noreferrer"/);
  });
});
