import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, isValidRecipientAddress, isValidStellarAddress } from "./stellar";

const ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("NETWORK_PASSPHRASE", () => {
  it("resolves the proper network passphrase", () => {
    expect(typeof NETWORK_PASSPHRASE).toBe("string");
    expect(NETWORK_PASSPHRASE.length).toBeGreaterThan(0);
  });
});

describe("isValidStellarAddress", () => {
  it("accepts valid account and contract StrKeys for their matching kinds", () => {
    expect(isValidStellarAddress(ACCOUNT, "account")).toBe(true);
    expect(isValidStellarAddress(CONTRACT, "contract")).toBe(true);
    expect(isValidStellarAddress(ACCOUNT)).toBe(true);
    expect(isValidStellarAddress(CONTRACT)).toBe(true);
  });

  it("rejects a one-character account typo with an invalid checksum", () => {
    const typo = `${ACCOUNT.slice(0, -1)}6`;

    expect(typo).toHaveLength(ACCOUNT.length);
    expect(isValidStellarAddress(typo, "account")).toBe(false);
    expect(isValidRecipientAddress(typo)).toBe(false);
  });

  it("rejects a valid muxed M-address where a G-account address is required", () => {
    const muxedPayload = Uint8Array.from([
      ...StrKey.decodeEd25519PublicKey(ACCOUNT),
      ...new Uint8Array(8),
    ]);
    const muxedAddress = StrKey.encodeMed25519PublicKey(muxedPayload);

    expect(muxedAddress.startsWith("M")).toBe(true);
    expect(StrKey.isValidMed25519PublicKey(muxedAddress)).toBe(true);
    expect(isValidStellarAddress(muxedAddress)).toBe(false);
    expect(isValidRecipientAddress(muxedAddress)).toBe(false);
  });
});
