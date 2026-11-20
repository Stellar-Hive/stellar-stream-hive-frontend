/**
 * Token display metadata (symbol + decimals), kept free of the Stellar SDK so
 * it can be unit tested.
 *
 * Why this matters: a stream's `total_amount` is a raw integer in the token's
 * smallest unit. Rendering it with the wrong `decimals` shows a balance that is
 * off by a power of ten (a 6-decimal token such as USDC formatted as if it had
 * 7 decimals reads 10x too small), so decimals must come from the token
 * contract itself rather than being assumed.
 *
 * Symbols and decimals are supplied by an arbitrary token contract, so they are
 * treated as untrusted input: symbols are length-limited and stripped of
 * control/bidi characters, and decimals must be a small non-negative integer.
 */
import type { Stream, TokenInfo } from "@/types";

/** Largest decimals value the app supports (matches the create form's input). */
export const MAX_TOKEN_DECIMALS = 18;
export const MAX_SYMBOL_LENGTH = 12;

/** Raw metadata as read from a token contract; either field may be absent or garbage. */
export interface RawTokenMetadata {
  symbol: unknown;
  decimals: unknown;
}

/** Reads metadata from chain. Resolves null when the contract can't be read. */
export type TokenReader = (contractId: string) => Promise<RawTokenMetadata | null>;

/** Used when metadata can't be read. 7 is the Stellar-asset default, but it is only a guess. */
export function fallbackToken(contractId: string): TokenInfo {
  return { contractId, symbol: "TOKEN", decimals: 7 };
}

/**
 * Cleans a symbol from a token contract: drops control characters and Unicode
 * bidi/zero-width controls (which can be used to spoof what's displayed),
 * trims, and caps the length. Returns null when nothing usable remains.
 */
export function sanitizeSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, "")
    .trim()
    .slice(0, MAX_SYMBOL_LENGTH);
  return cleaned === "" ? null : cleaned;
}

/** Accepts only integers in [0, MAX_TOKEN_DECIMALS]; bigint and numeric strings are tolerated. */
export function sanitizeDecimals(raw: unknown): number | null {
  let value: number;
  if (typeof raw === "number") value = raw;
  else if (typeof raw === "bigint") value = Number(raw);
  else if (typeof raw === "string" && /^\d+$/.test(raw)) value = Number(raw);
  else return null;
  return Number.isInteger(value) && value >= 0 && value <= MAX_TOKEN_DECIMALS ? value : null;
}

/**
 * Turns raw metadata into a `TokenInfo`. `detected` is true only when BOTH
 * fields were valid: a half-valid result falls back entirely, because pairing a
 * real symbol with guessed decimals would look trustworthy while being wrong.
 */
export function toTokenInfo(contractId: string, raw: RawTokenMetadata | null): { token: TokenInfo; detected: boolean } {
  const symbol = raw ? sanitizeSymbol(raw.symbol) : null;
  const decimals = raw ? sanitizeDecimals(raw.decimals) : null;
  if (symbol === null || decimals === null) return { token: fallbackToken(contractId), detected: false };
  return { token: { contractId, symbol, decimals }, detected: true };
}

export interface TokenMetadataCache {
  /** Resolves display info for a token, never rejecting. */
  get(contractId: string): Promise<TokenInfo>;
  /** Like `get`, but also says whether the values were read from the contract. */
  lookup(contractId: string): Promise<{ token: TokenInfo; detected: boolean }>;
}

/**
 * Caches successful lookups and shares in-flight ones, so a list of 50 streams
 * in the same token costs one pair of RPC reads rather than 50. Failures are NOT
 * cached: a transient RPC error shouldn't pin the fallback for the whole session.
 * `known` entries (e.g. native XLM) are answered without touching the network.
 */
export function createTokenMetadataCache(read: TokenReader, known: Record<string, TokenInfo> = {}): TokenMetadataCache {
  const resolved = new Map<string, TokenInfo>();
  const inFlight = new Map<string, Promise<{ token: TokenInfo; detected: boolean }>>();

  async function lookup(contractId: string): Promise<{ token: TokenInfo; detected: boolean }> {
    const preset = known[contractId];
    if (preset) return { token: preset, detected: true };

    const cached = resolved.get(contractId);
    if (cached) return { token: cached, detected: true };

    const pending = inFlight.get(contractId);
    if (pending) return pending;

    const request = (async () => {
      let raw: RawTokenMetadata | null = null;
      try {
        raw = await read(contractId);
      } catch {
        raw = null;
      }
      const result = toTokenInfo(contractId, raw);
      if (result.detected) resolved.set(contractId, result.token);
      return result;
    })().finally(() => inFlight.delete(contractId));

    inFlight.set(contractId, request);
    return request;
  }

  return {
    lookup,
    get: async (contractId) => (await lookup(contractId)).token,
  };
}

/**
 * Replaces each stream's placeholder token with real metadata. Streams that
 * share a token trigger a single lookup. Returns new objects; inputs are untouched.
 */
export async function enrichStreamTokens(
  streams: Stream[],
  getToken: (contractId: string) => Promise<TokenInfo>
): Promise<Stream[]> {
  const ids = Array.from(new Set(streams.map((s) => s.token.contractId)));
  const entries = await Promise.all(ids.map(async (id) => [id, await getToken(id)] as const));
  const byId = new Map(entries);
  return streams.map((s) => ({ ...s, token: byId.get(s.token.contractId) ?? s.token }));
}
