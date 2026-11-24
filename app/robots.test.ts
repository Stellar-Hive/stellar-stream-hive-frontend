import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  const original = process.env.NEXT_PUBLIC_NOINDEX;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_NOINDEX;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_NOINDEX;
    else process.env.NEXT_PUBLIC_NOINDEX = original;
  });

  it("allows public pages and disallows per-user/dynamic ones by default", () => {
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/streams/new"],
          disallow: ["/streams/", "/sending", "/receiving"],
        },
      ],
    });
  });

  it("disallows everything when NEXT_PUBLIC_NOINDEX is set", () => {
    process.env.NEXT_PUBLIC_NOINDEX = "1";
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});
