/**
 * Formatting helpers for base-unit (BigInt) token amounts.
 *
 * Stellar/Soroban token amounts are fixed-point integers with (typically) 7
 * decimal places of precision ("stroops" for XLM). We keep every amount as a
 * BigInt of base units until the very last moment it needs to be rendered as
 * a string, and we always floor rather than round up.
 */

export const STROOP_DECIMALS = 7;

/** 10^decimals, as a BigInt, for fixed-point conversions. */
export function decimalsFactor(decimals: number = STROOP_DECIMALS): bigint {
  return 10n ** BigInt(decimals);
}

/**
 * Converts a human-entered decimal string (e.g. "1234.5000000") into base
 * units (BigInt), flooring any excess precision rather than rounding.
 */
export function parseAmountToBaseUnits(input: string, decimals: number = STROOP_DECIMALS): bigint {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  if (negative) throw new Error("Amount must not be negative");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    throw new Error("Invalid amount");
  }

  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");

  const factor = decimalsFactor(decimals);
  return BigInt(whole) * factor + BigInt(frac === "" ? "0" : frac);
}

/**
 * Converts a base-unit BigInt amount into a human-readable decimal string,
 * always flooring (truncating) — never rounding up — and trimming trailing
 * zeros unless `minDecimals` is given.
 */
export function formatBaseUnits(
  amount: bigint,
  decimals: number = STROOP_DECIMALS,
  options: { maxDecimals?: number; minDecimals?: number; grouped?: boolean } = {}
): string {
  const { maxDecimals = decimals, minDecimals = 2, grouped = true } = options;
  const factor = decimalsFactor(decimals);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;

  const whole = abs / factor;
  const remainder = abs % factor;

  // Full-precision fractional digits, left-padded to `decimals`.
  let fracDigits = remainder.toString().padStart(decimals, "0");

  // Floor to maxDecimals (truncate, do not round).
  fracDigits = fracDigits.slice(0, maxDecimals);

  // Pad up to minDecimals if needed.
  while (fracDigits.length < minDecimals) fracDigits += "0";

  // Trim trailing zeros beyond minDecimals.
  while (fracDigits.length > minDecimals && fracDigits.endsWith("0")) {
    fracDigits = fracDigits.slice(0, -1);
  }

  const wholeStr = grouped ? groupThousands(whole.toString()) : whole.toString();
  const sign = negative ? "-" : "";

  return fracDigits.length > 0 ? `${sign}${wholeStr}.${fracDigits}` : `${sign}${wholeStr}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Formats a base-unit amount with a trailing token symbol, e.g. "12.3456789 XLM". */
export function formatTokenAmount(
  amount: bigint,
  symbol: string,
  decimals: number = STROOP_DECIMALS,
  maxDecimals: number = decimals
): string {
  return `${formatBaseUnits(amount, decimals, { maxDecimals, minDecimals: 2 })} ${symbol}`;
}

/** Formats a G... / C... Stellar address as a shortened "GABCD…WXYZ" string. */
export function shortenAddress(address: string, lead: number = 4, trail: number = 4): string {
  if (!address || address.length <= lead + trail + 3) return address;
  return `${address.slice(0, lead)}…${address.slice(-trail)}`;
}

/**
 * Builds a Stellar Expert explorer URL for an account or contract address.
 * Returns `null` when `network` is `null` (e.g. Futurenet, which Stellar
 * Expert does not index) so callers can hide the link instead of pointing
 * at the wrong network.
 */
export function stellarExpertAccountUrl(address: string, network: "testnet" | "public" | null = "testnet"): string | null {
  if (network === null) return null;
  const kind = address.startsWith("C") ? "contract" : "account";
  return `https://stellar.expert/explorer/${network}/${kind}/${address}`;
}

/**
 * Builds a Stellar Expert explorer URL for a transaction hash. Returns
 * `null` when `network` is `null` (see {@link stellarExpertAccountUrl}).
 */
export function stellarExpertTxUrl(hash: string, network: "testnet" | "public" | null = "testnet"): string | null {
  if (network === null) return null;
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/** Formats a plain number of base units per second/hour/day into a human rate string. */
export function formatRate(amountPerSecond: number, symbol: string): { perSecond: string; perHour: string; perDay: string } {
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return "0";
    if (n === 0) return "0";
    if (n < 0.0000001) return n.toExponential(2);
    return n.toFixed(n < 1 ? 7 : n < 100 ? 4 : 2);
  };
  return {
    perSecond: `${fmt(amountPerSecond)} ${symbol}`,
    perHour: `${fmt(amountPerSecond * 3600)} ${symbol}`,
    perDay: `${fmt(amountPerSecond * 86400)} ${symbol}`,
  };
}

/**
 * Computes per-second/hour/day streaming rates from a base-unit (BigInt) total
 * amount and a duration in seconds, entirely in BigInt arithmetic so large
 * amounts never pass through a JS `number` (which loses precision above
 * `Number.MAX_SAFE_INTEGER`). Each rate is floored to the token's base unit,
 * never rounded up — a true rate smaller than one base unit per second will
 * correctly display as "0" rather than a fabricated fractional value.
 */
export function formatRateFromBaseUnits(
  totalAmount: bigint,
  totalSeconds: number,
  symbol: string,
  decimals: number = STROOP_DECIMALS
): { perSecond: string; perHour: string; perDay: string } {
  const zero = {
    perSecond: formatTokenAmount(0n, symbol, decimals, decimals),
    perHour: formatTokenAmount(0n, symbol, decimals, decimals),
    perDay: formatTokenAmount(0n, symbol, decimals, decimals),
  };
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return zero;

  const secondsBig = BigInt(Math.floor(totalSeconds));
  if (secondsBig <= 0n) return zero;

  const perSecond = totalAmount / secondsBig;
  const perHour = (totalAmount * 3600n) / secondsBig;
  const perDay = (totalAmount * 86400n) / secondsBig;

  return {
    perSecond: formatTokenAmount(perSecond, symbol, decimals, decimals),
    perHour: formatTokenAmount(perHour, symbol, decimals, decimals),
    perDay: formatTokenAmount(perDay, symbol, decimals, decimals),
  };
}

/**
 * Describes the UTC offset that applies at `date` as e.g. "UTC+1", "UTC-3:30" or "UTC+0",
 * using the runtime's timezone rules for that instant. Pass `timeZone` (an IANA name) to
 * format for a specific zone instead of the local one. Returns null if the runtime cannot
 * produce the offset.
 */
export function formatUtcOffset(date: Date, timeZone?: string): string | null {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    if (part === undefined || !part.startsWith("GMT")) return null;
    const offset = part.slice("GMT".length);
    return `UTC${offset || "+0"}`;
  } catch {
    return null;
  }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Describes how far away `targetMs` is from `nowMs` as a short countdown such
 * as "3d 4h", "5h 12m", "4m" or "less than a minute". Whole units are floored,
 * never rounded up. Returns `null` when the target is not in the future or
 * either timestamp is invalid, so callers can hide the countdown instead of
 * showing a fabricated value.
 */
export function formatTimeUntil(targetMs: number, nowMs: number): string | null {
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return null;
  const remaining = targetMs - nowMs;
  if (remaining <= 0) return null;
  if (remaining < MINUTE_MS) return "less than a minute";

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Describes how long ago `thenMs` was relative to `nowMs` as a short label:
 * "just now" under five seconds, then "30s ago", "5m ago", "2h ago", "3d ago".
 * Times in the future are treated as "just now".
 */
export function formatTimeAgo(thenMs: number, nowMs: number): string {
  if (!Number.isFinite(thenMs) || !Number.isFinite(nowMs)) return "just now";
  const elapsed = Math.max(0, nowMs - thenMs);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
