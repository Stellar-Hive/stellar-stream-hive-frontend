import { describe, expect, it } from "vitest";
import { buildRobotsRules, isNoindexEnabled } from "./seo";

describe("isNoindexEnabled", () => {
  it.each(["1", "true", "TRUE", " 1 "])("enables noindex for %j", (value) => {
    expect(isNoindexEnabled(value)).toBe(true);
  });

  it.each([undefined, "", "0", "false", "yes"])("keeps indexing for %j", (value) => {
    expect(isNoindexEnabled(value)).toBe(false);
  });
});

describe("buildRobotsRules", () => {
  it("disallows every path when noindex is on", () => {
    expect(buildRobotsRules(true)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });

  it("keeps the public allow/disallow rules when noindex is off", () => {
    const robots = buildRobotsRules(false);
    expect(robots).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/streams/new"],
          disallow: ["/streams/", "/sending", "/receiving"],
        },
      ],
    });
  });
});
