/**
 * Search-engine indexing helpers. Staging or testnet deployments set
 * NEXT_PUBLIC_NOINDEX=1 so they are not indexed.
 */
import type { MetadataRoute } from "next";

/** True when the raw env value is "1" or "true" (case-insensitive, trimmed). */
export function isNoindexEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function buildRobotsRules(noindex: boolean): MetadataRoute.Robots {
  if (noindex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/streams/new"],
        // Individual stream pages and wallet-scoped dashboards are dynamic,
        // per-user views rather than content worth indexing individually.
        disallow: ["/streams/", "/sending", "/receiving"],
      },
    ],
  };
}
