import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Reads the package version. Falls back to "dev" if package.json cannot be read.
 */
function readAppVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
    return pkg.version || 'dev';
  } catch {
    return 'dev';
  }
}

/**
 * Returns a short commit sha for the build. Prefers the CI/hosting provider's
 * sha, then `git rev-parse`, and falls back to "dev" when neither is available.
 */
function readCommitSha() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return sha || 'dev';
  } catch {
    return 'dev';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: readAppVersion(),
    NEXT_PUBLIC_APP_COMMIT: readCommitSha(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  // Issue #110: a Content-Security-Policy is deliberately not set here — it
  // needs a separate review because of Freighter (extension-injected script)
  // and the RPC calls this app makes to Soroban/Horizon endpoints.
};

export default nextConfig;
