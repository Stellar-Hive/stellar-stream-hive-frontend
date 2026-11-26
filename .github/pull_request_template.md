## Summary

<!-- What does this PR change, and why? -->

## Related issue

Closes #

## Checklist

Mirrors [CONTRIBUTING.md](../CONTRIBUTING.md) — please confirm before requesting review.

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Token amounts stay `BigInt` end to end and are floored, never rounded up
- [ ] No stroop/base-unit amount is represented as a JS `number`; conversion to a display string happens only at render via `lib/format.ts`
- [ ] Wallet and network errors (Freighter missing, wrong network, rejected signature, RPC timeout) render a helpful state, not an uncaught exception
- [ ] No fabricated data: unavailable data shows a loading, empty, or error state
- [ ] Transaction amounts are re-fetched on-chain immediately before submitting, not taken from the client-side estimate
- [ ] UI changes include before/after screenshots (see the Screenshots section below)
- [ ] UI changes were checked with the keyboard only and with a screen reader (focus order, labels, status messages)
- [ ] Any BigInt arithmetic was reviewed for flooring and for no `number` conversion of amounts

## Screenshots (UI changes)

<!-- Before / after screenshots or a short recording. Delete this section if there is no UI change. -->
