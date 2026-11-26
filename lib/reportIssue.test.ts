import { describe, expect, it } from "vitest";
import { buildReportIssueBody, buildReportIssueUrl, ISSUE_REPO_URL } from "./reportIssue";

const CTX = {
  appVersion: "0.1.0",
  appCommit: "1a2b3c4",
  network: "TESTNET",
  contractIds: {
    Stream: "CSTREAM",
    Vault: undefined,
    Registry: "",
  },
};

describe("buildReportIssueBody", () => {
  it("lists version, network and contract ids", () => {
    const body = buildReportIssueBody(CTX);
    expect(body).toContain("App version: 0.1.0 (1a2b3c4)");
    expect(body).toContain("Network: TESTNET");
    expect(body).toContain("- Stream: CSTREAM");
  });

  it("marks missing contract ids as not configured", () => {
    const body = buildReportIssueBody(CTX);
    expect(body).toContain("- Vault: not configured");
    expect(body).toContain("- Registry: not configured");
  });
});

describe("buildReportIssueUrl", () => {
  it("points at the repository's new-issue page with an encoded body", () => {
    const url = new URL(buildReportIssueUrl(CTX));
    expect(url.origin + url.pathname).toBe(`${ISSUE_REPO_URL}/issues/new`);
    expect(url.searchParams.get("body")).toBe(buildReportIssueBody(CTX));
  });

  it("never includes a wallet address field", () => {
    const url = buildReportIssueUrl({ ...CTX, contractIds: {} });
    expect(url.toLowerCase()).not.toContain("wallet");
    expect(url).not.toMatch(/G[A-Z2-7]{55}/);
  });
});
