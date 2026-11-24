import { beforeEach, describe, expect, it } from "vitest";
import { clearStreamDraft, loadStreamDraft, saveStreamDraft } from "./createStreamDraft";

const DRAFT_KEY = "stream-hive:create-draft";

const SAMPLE = {
  recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  amount: "10",
  tokenContractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  tokenSymbol: "XLM",
  tokenDecimals: 7,
  cancellable: true,
  startDate: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  cliffDate: null,
  endDate: new Date("2026-02-01T00:00:00.000Z").toISOString(),
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("saveStreamDraft / loadStreamDraft", () => {
  it("round-trips a saved draft", () => {
    saveStreamDraft(SAMPLE);
    expect(loadStreamDraft()).toEqual({ version: 1, ...SAMPLE });
  });

  it("returns null when nothing is saved", () => {
    expect(loadStreamDraft()).toBeNull();
  });

  it("discards malformed JSON instead of throwing", () => {
    sessionStorage.setItem(DRAFT_KEY, "{not json");
    expect(loadStreamDraft()).toBeNull();
  });

  it("discards a draft from a future/mismatched version", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 999, ...SAMPLE }));
    expect(loadStreamDraft()).toBeNull();
  });

  it("discards a draft missing required fields", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, recipient: "only this" }));
    expect(loadStreamDraft()).toBeNull();
  });
});

describe("clearStreamDraft", () => {
  it("removes a saved draft", () => {
    saveStreamDraft(SAMPLE);
    clearStreamDraft();
    expect(loadStreamDraft()).toBeNull();
  });
});
