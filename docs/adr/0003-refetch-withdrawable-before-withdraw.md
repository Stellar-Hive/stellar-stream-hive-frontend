# ADR 0003: Re-fetch the withdrawable amount before withdrawing

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The recipient's balance on screen is an estimate. `hooks/useLiveBalance.ts` estimates the
current ledger at about 5 seconds per ledger, ticks once per second and re-syncs every
30 seconds. The estimate can be ahead of or behind the chain. A withdrawal that uses the
on-screen number could request more than the contract allows, or pay out less than the user
expects.

## Decision

The estimate is for display only. Before any withdrawal is signed, the app re-reads the real
amount from the contract with `fetchWithdrawableOnChain` (`lib/contracts.ts`):

- For a full withdrawal, the amount sent is the freshly fetched value.
- For a custom amount, the request is checked against the freshly fetched value. If it is
  larger, the withdrawal is refused with a message asking the user to refresh.
- If the fetched amount is zero, the withdrawal is refused with "Nothing is withdrawable yet."

## Consequences

- Each withdrawal costs one extra contract read before signing.
- The UI can briefly show "checking" before the wallet prompt appears.
- Any new transaction that uses an amount from the UI must follow the same pattern.

## Source

- `components/stream/WithdrawButton.tsx`: `handleWithdraw` calls `fetchWithdrawableOnChain`
  before `withdrawOnChain`
- `lib/contracts.ts`: `fetchWithdrawableOnChain`
- `hooks/useLiveBalance.ts`: the display estimate
- `README.md`: "The signature feature: LiveBalance"
- `CONTRIBUTING.md`: "Never trust the client-side estimate"
