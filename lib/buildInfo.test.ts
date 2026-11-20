import { describe, expect, it } from "vitest";
import { formatBuildLabel, getBuildInfo } from "./buildInfo";

describe("getBuildInfo", () => {
  it("keeps the build version and commit", () => {
    expect(getBuildInfo("0.1.0", "1a2b3c4")).toEqual({ version: "0.1.0", commit: "1a2b3c4" });
  });

  it("falls back to dev when values are missing or empty", () => {
    expect(getBuildInfo(undefined, undefined)).toEqual({ version: "dev", commit: "dev" });
    expect(getBuildInfo("", "")).toEqual({ version: "dev", commit: "dev" });
  });
});

describe("formatBuildLabel", () => {
  it("prefixes real versions with v", () => {
    expect(formatBuildLabel({ version: "0.1.0", commit: "1a2b3c4" })).toBe("v0.1.0 · 1a2b3c4");
  });

  it("does not prefix the dev fallback", () => {
    expect(formatBuildLabel({ version: "dev", commit: "dev" })).toBe("dev · dev");
  });
});
