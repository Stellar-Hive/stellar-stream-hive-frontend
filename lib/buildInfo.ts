/**
 * Build metadata injected at build time through `env` in next.config.mjs.
 * Both values fall back to "dev" when they were not available during the build
 * (for example, when running from a tarball without git history).
 */

export interface BuildInfo {
  version: string;
  commit: string;
}

/**
 * Normalises the raw build values. Callers pass `process.env.NEXT_PUBLIC_APP_VERSION`
 * and `process.env.NEXT_PUBLIC_APP_COMMIT` as literal accesses: Next only inlines
 * those into client bundles, so the whole `process.env` object cannot be passed.
 */
export function getBuildInfo(version?: string, commit?: string): BuildInfo {
  return {
    version: version || "dev",
    commit: commit || "dev",
  };
}

/** Short human label for the footer, e.g. "v0.1.0 · 1a2b3c4", or "dev · dev" for unknown builds. */
export function formatBuildLabel({ version, commit }: BuildInfo): string {
  const shownVersion = version === "dev" ? version : `v${version}`;
  return `${shownVersion} · ${commit}`;
}
