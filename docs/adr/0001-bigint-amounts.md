# ADR 0001: Token amounts are BigInt end to end

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

Stellar amounts are fixed-point integers in base units (stroops for XLM, with each token's
own decimals). The Soroban contract does i128 arithmetic and floors on division. JavaScript
`number` cannot represent every integer above `Number.MAX_SAFE_INTEGER` (2^53 - 1), so a
float-based balance can drift from what the contract will actually pay out.

## Decision

Every stroop or base-unit amount is a `bigint` in the calculation path. Streamed and
withdrawable amounts are computed with multiply-before-divide and floored. Conversion to a
human-readable decimal string happens only at the final render step, through `lib/format.ts`.

Amounts that cross a boundary as strings (API payloads, `Stream` objects) are converted with
`BigInt(...)` on the way in and kept as decimal strings until they are displayed.

## Consequences

- The formula in `lib/streaming.ts` matches the contract's arithmetic. Tests in
  `lib/streaming.test.ts` cover flooring, cliff behaviour and precision above
  `Number.MAX_SAFE_INTEGER`.
- One documented exception: `computeRatePerSecond` in `lib/streaming.ts` returns a `number`
  for a human-readable rate. It is for display only and must never feed a balance or a
  transaction amount.
- Contributors must not add `Number(...)` or `parseFloat(...)` to an amount without a reason
  recorded in the PR.

## Source

- `lib/streaming.ts`: header comment and `computeRatePerSecond`
- `lib/format.ts`: BigInt to decimal string conversion
- `lib/streamMapping.ts`: `mapRawStream` keeps `totalAmount` and `withdrawnAmount` as strings
- `CONTRIBUTING.md`: "Token amounts are BigInt, always"
