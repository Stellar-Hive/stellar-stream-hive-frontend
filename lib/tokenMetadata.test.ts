import { describe, expect, it } from "vitest";
import { MAX_TOKEN_DECIMALS, sanitizeDecimals } from "./tokenMetadata";

describe("sanitizeDecimals", () => {
  it("accepts a plain number", () => {
    expect(sanitizeDecimals(7)).toBe(7);
  });

  it("tolerates a bigint", () => {
    expect(sanitizeDecimals(7n)).toBe(7);
  });

  it("tolerates a numeric string", () => {
    expect(sanitizeDecimals("7")).toBe(7);
  });

  it("tolerates a zero-padded numeric string", () => {
    expect(sanitizeDecimals("07")).toBe(7);
  });

  it("rejects a negative numeric string", () => {
    expect(sanitizeDecimals("-1")).toBeNull();
  });

  it("rejects a negative number", () => {
    expect(sanitizeDecimals(-1)).toBeNull();
  });

  it("rejects a negative bigint", () => {
    expect(sanitizeDecimals(-1n)).toBeNull();
  });

  it("rejects values above the supported maximum", () => {
    expect(sanitizeDecimals(MAX_TOKEN_DECIMALS + 1)).toBeNull();
  });

  it("accepts the supported maximum", () => {
    expect(sanitizeDecimals(MAX_TOKEN_DECIMALS)).toBe(MAX_TOKEN_DECIMALS);
  });

  it("rejects non-integer numbers", () => {
    expect(sanitizeDecimals(7.5)).toBeNull();
  });

  it("rejects non-numeric strings", () => {
    expect(sanitizeDecimals("abc")).toBeNull();
    expect(sanitizeDecimals("7.5")).toBeNull();
    expect(sanitizeDecimals("")).toBeNull();
  });

  it("rejects other types", () => {
    expect(sanitizeDecimals(null)).toBeNull();
    expect(sanitizeDecimals(undefined)).toBeNull();
    expect(sanitizeDecimals(true)).toBeNull();
    expect(sanitizeDecimals({})).toBeNull();
  });
});
