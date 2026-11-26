/**
 * Builds a prefilled GitHub "new issue" link for the footer. The link carries
 * only app context that helps reproduce a bug: the build version, the
 * configured network and the configured contract ids. It never includes the
 * connected wallet address, and the app sends nothing itself; GitHub only sees
 * what the user chooses to submit.
 */

export const ISSUE_REPO_URL = "https://github.com/Stellar-Hive/stellar-stream-hive-frontend";

export interface ReportIssueContext {
  appVersion: string;
  appCommit: string;
  network: string;
  /** Configured contract ids, keyed by a human label. Empty/undefined values are shown as "not configured". */
  contractIds: Record<string, string | undefined>;
}

export function buildReportIssueBody(ctx: ReportIssueContext): string {
  const contractLines = Object.entries(ctx.contractIds).map(
    ([label, id]) => `- ${label}: ${id ? id : "not configured"}`,
  );
  return [
    "### Environment",
    `- App version: ${ctx.appVersion} (${ctx.appCommit})`,
    `- Network: ${ctx.network}`,
    "- Contracts:",
    ...contractLines.map((line) => `  ${line}`),
    "",
    "### What happened",
    "",
    "### Steps to reproduce",
    "1.",
    "",
    "### Expected behaviour",
    "",
  ].join("\n");
}

export function buildReportIssueUrl(ctx: ReportIssueContext): string {
  const params = new URLSearchParams({ body: buildReportIssueBody(ctx) });
  return `${ISSUE_REPO_URL}/issues/new?${params.toString()}`;
}
