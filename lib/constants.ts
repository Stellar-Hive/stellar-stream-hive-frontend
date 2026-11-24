/** One day in milliseconds. */
export const ONE_DAY_MS = 86_400_000;

/** How often live balances re-read the on-chain withdrawable amount. */
export const RESYNC_MS = 30_000;

/** How often live balances and timelines re-render their elapsed time. */
export const TICK_MS = 1_000;

/** How long to wait for the indexer API to respond before giving up. */
export const API_TIMEOUT_MS = 10_000;
