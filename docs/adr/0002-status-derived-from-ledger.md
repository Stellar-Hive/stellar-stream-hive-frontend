# ADR 0002: Stream status is derived from the ledger

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

A stream's lifecycle (scheduled, cliff, active, completed, cancelled) depends on where the
current ledger sits relative to `start_ledger`, `cliff_ledger` and `end_ledger`. The raw
record can be stale, and the indexer API may lag the chain. The UI must not show "active"
for a stream that has not started yet.

## Decision

Terminal states from the contract record win: a `Cancelled` or `Completed` variant is
returned as is. For every other stream, the status is computed from the latest ledger:

1. No current ledger known: `active`
2. Current ledger before `start_ledger`: `scheduled`
3. Current ledger at or after `end_ledger`: `completed`
4. Cliff configured and current ledger before `cliff_ledger`: `cliff`
5. Otherwise: `active`

The indexer API path (`mapApiStatus`) does not repeat these rules. It maps the API's own
status: `pending` becomes `scheduled`, `cancelled` and `completed` pass through, and `active`
becomes `cliff` only when a current ledger is known and sits before the cliff ledger.

## Consequences

- A status depends on a ledger snapshot. Callers that have no snapshot get `active` by
  default, so pages should load the snapshot before showing a badge.
- Tests in `lib/streamMapping.test.ts` pin the cancelled and cliff cases.
- A change to the lifecycle rules needs an update to this ADR and to those tests.

## Source

- `lib/streamMapping.ts`: `deriveOnChainStatus`, `mapApiStatus`, `mapRawStream`
- `hooks/useLedgerSnapshot.ts`: supplies the current ledger
- `components/stream/StreamStatusBadge.tsx`: renders the status
