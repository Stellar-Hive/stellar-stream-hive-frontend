import { describe, expect, it } from "vitest";
import { buildDuplicateQueryString, hasAnyPrefillValue, parseStreamPrefill } from "./createStreamPrefill";

const VALID_RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const VALID_TOKEN_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("parseStreamPrefill", () => {
  it("accepts valid recipient, amount and token", () => {
    const params = new URLSearchParams({
      recipient: VALID_RECIPIENT,
      amount: "100.5",
      token: VALID_TOKEN_CONTRACT,
      cancellable: "false",
    });
    expect(parseStreamPrefill(params)).toEqual({
      recipient: VALID_RECIPIENT,
      amount: "100.5",
      tokenContractId: VALID_TOKEN_CONTRACT,
      cancellable: false,
    });
  });

  it("ignores an invalid recipient address", () => {
    const params = new URLSearchParams({ recipient: "not-a-stellar-address" });
    expect(parseStreamPrefill(params)).toEqual({});
  });

  it("ignores a malformed amount", () => {
    for (const bad of ["abc", "-5", "0", "1.2.3", ""]) {
      const params = new URLSearchParams({ amount: bad });
      expect(parseStreamPrefill(params).amount).toBeUndefined();
    }
  });

  it("ignores an invalid token contract id", () => {
    const params = new URLSearchParams({ token: "not-a-contract" });
    expect(parseStreamPrefill(params)).toEqual({});
  });

  it("ignores a cancellable value that isn't exactly 'true' or 'false'", () => {
    const params = new URLSearchParams({ cancellable: "yes" });
    expect(parseStreamPrefill(params).cancellable).toBeUndefined();
  });

  it("returns an empty object when params are missing", () => {
    expect(parseStreamPrefill(new URLSearchParams())).toEqual({});
  });
});

describe("hasAnyPrefillValue", () => {
  it("is false for an empty prefill", () => {
    expect(hasAnyPrefillValue({})).toBe(false);
  });

  it("is true when any field is present", () => {
    expect(hasAnyPrefillValue({ cancellable: false })).toBe(true);
  });
});

describe("buildDuplicateQueryString", () => {
  it("round-trips through parseStreamPrefill", () => {
    const qs = buildDuplicateQueryString({
      recipient: VALID_RECIPIENT,
      tokenContractId: VALID_TOKEN_CONTRACT,
      amount: "42.1",
      cancellable: true,
    });
    const parsed = parseStreamPrefill(new URLSearchParams(qs));
    expect(parsed).toEqual({
      recipient: VALID_RECIPIENT,
      amount: "42.1",
      tokenContractId: VALID_TOKEN_CONTRACT,
      cancellable: true,
    });
  });
});
