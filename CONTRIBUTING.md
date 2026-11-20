# Contributing to Stellar Stream Hive (Frontend)

Thanks for your interest in contributing! This repo is the Next.js frontend for Stellar Stream
Hive. Contributions of all sizes are welcome — bug fixes, new components, accessibility
improvements, documentation, and design polish.

By participating in this project you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Repository layout

See the "Project structure" section of [`README.md`](./README.md) for a map of `app/`,
`components/`, `hooks/`, and `lib/`. [`docs/architecture.md`](./docs/architecture.md) explains
which layer may import which, and where each kind of data comes from. Read it before adding a
new module or a new network call.

Related repositories, if your change touches contract behavior or indexed data instead of the
frontend itself:

- Contracts: https://github.com/Stellar-Hive/stellar-stream-hive-contract
- API / indexer: https://github.com/Stellar-Hive/stellar-stream-hive-api

## Getting set up

```bash
git clone https://github.com/Stellar-Hive/stellar-stream-hive-frontend.git
cd stellar-stream-hive-frontend
npm install
cp .env.example .env.local
npm run dev
```

You'll need the [Freighter](https://www.freighter.app/) browser extension to exercise
wallet-connected flows locally, set to **Testnet**.

Contract-calling features (create/withdraw/cancel a stream) require
`NEXT_PUBLIC_STREAM_CONTRACT_ID` (and friends) to point at a real deployed contract. If you're
only working on UI/UX that doesn't touch live contract state, you can leave these unset — the
app will show a clear "not yet configured" state rather than erroring.

## Testnet funds and Freighter setup

Wallet-connected features only work on the Stellar **testnet**, and the testnet account you use
must be funded before it can sign anything. Follow these steps once per browser profile:

1. **Install Freighter.** Add the [Freighter](https://www.freighter.app/) extension to a
   Chromium or Firefox browser, then create a wallet or import an existing one. Use a test wallet
   only, never one that holds real funds.
2. **Switch Freighter to Testnet.** Open Freighter, open the network selector, and choose
   **Testnet**. The app reads `NEXT_PUBLIC_STELLAR_NETWORK` from `.env.local` (`TESTNET` in
   `.env.example`), so Freighter and the app must agree. The
   [wrong-network message](./README.md#troubleshooting) appears when they do not.
3. **Fund the account with Friendbot.** Copy your public key (the `G…` address) from Freighter,
   then open this URL in your browser, replacing `<PUBLIC_KEY>` with that address:

   ```
   https://friendbot.stellar.org/?addr=<PUBLIC_KEY>
   ```

   Friendbot gives the account test XLM. It works only on testnet. Repeat for each account you
   need, such as a sender and a recipient.
4. **Start the app and connect.** Run `npm run dev`, open
   [http://localhost:3000](http://localhost:3000), and click the wallet connect button. If
   Freighter asks whether this site may connect, allow it. The network badge should then read
   Testnet.

If Freighter is not detected at all, reload the page after installing it. The
[troubleshooting table in the README](./README.md#troubleshooting) lists the other common
errors.

## Running against a local API and testnet contracts

The app shows real streams only when it can reach an indexer API. To try the full flow:

1. **Run the indexer.** In a clone of
   [stellar-stream-hive-api](https://github.com/Stellar-Hive/stellar-stream-hive-api), copy
   `.env.example` to `.env`, set `STREAM_CONTRACT_ID` to the testnet contract ID from that file,
   and run `cargo run`. It listens on `http://localhost:8080` by default. It picks up new
   streams on its next poll, which is every 10 seconds by default.
2. **Point the frontend at it.** In `.env.local`, set
   `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`, then restart `npm run dev`.
3. **Fund two testnet accounts.** In Freighter, switch to **Testnet** and create or import a
   sender and a recipient account. Fund each one with Friendbot as described in
   [Testnet funds and Freighter setup](#testnet-funds-and-freighter-setup). Never use a mainnet
   key here.
4. **Create a test stream.** Connect the sender account, enter the recipient's address, keep
   XLM as the token, choose a small amount, and submit. Freighter asks you to sign. Once the
   transaction confirms, the stream shows up in the sender's list after the indexer's next poll.

## Development guidelines

- **TypeScript strictness**: the project builds with `strict: true`. Please don't introduce
  `any` where a real type is available.
- **Token amounts are BigInt, always.** Never represent a stroop/base-unit amount as a JS
  `number` — floating point cannot represent Stellar's fixed-point precision safely. Convert to
  a human-readable string only at the final render step, via `lib/format.ts`.
- **Round down, never up.** Anywhere you compute a withdrawable or streamed amount, floor it.
  Showing a user a balance they can't actually withdraw is treated as a bug, not a rounding
  nuance.
- **Never trust the client-side estimate for a transaction amount.** `useLiveBalance` and
  `StreamProgress` exist to make the UI feel alive; the actual withdraw call must re-fetch the
  real on-chain withdrawable amount immediately before submitting (see
  `lib/contracts.ts#fetchWithdrawableOnChain` and how `WithdrawButton` uses it).
- **Handle wallet/network errors explicitly.** Freighter not installed, wrong network, rejected
  signature, RPC timeouts — all of these should render a helpful `ErrorState` or inline message,
  never an uncaught exception or a silently-failed button.
- **No fabricated data.** If the indexer API or a contract call isn't available, show a loading
  or empty state that says so. Never invent numbers, contract IDs, or transaction hashes to make
  a screen look populated.

## Accessibility checklist

Check these for every new or changed component:

- **Labels:** every control has an accessible name, from visible text, `aria-label` or
  `aria-labelledby`. Icon-only buttons need a label.
- **Focus order:** focus moves in the same order as the layout, and no visible control is
  skipped.
- **Keyboard use:** anything clickable can also be reached with Tab and activated with Enter or
  Space. Don't rely on hover to reveal something.
- **Colour contrast:** text and icons meet WCAG AA contrast in both light and dark themes.
  Colour alone must not carry meaning.
- **Reduced motion:** animations respect `prefers-reduced-motion`.
- **Dynamic content:** loading, status and error messages that appear without a page change use
  `role="status"`, `role="alert"` or `aria-live`.

## Before opening a PR

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four should pass cleanly; CI runs the same commands on every pull request. If you change
logic under `lib/`, add or update a unit test next to it. If you touched `lib/streaming.ts` or
`lib/format.ts`, please also double check the BigInt math with a couple of manual examples —
these functions are load-bearing for correctness across the whole app.

## Branch names

Branch from `main` and name the branch `<type>/<short-description>`, where `<type>` is one of
the commit prefixes below and the description is a few lowercase words separated by hyphens.
Include the issue number when the branch fixes one:

- `fix/16-19-explorer-withdrawable-horizon-lint`
- `test/issues-28-29-freighter-stellar-tests`
- `docs/280-281-282-283-docs-and-architecture`

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes. These are the ones
already used in this repository's history:

| Prefix | Use it for |
| --- | --- |
| `fix:` | A bug fix in app behaviour |
| `feat:` | A new user-visible feature or capability |
| `test:` | Adding or changing tests without changing app behaviour |
| `perf:` | A change made for speed or fewer requests, with no change in results |
| `chore:` | Tooling, lint configuration, dependencies and cleanup |
| `docs:` | Documentation only, such as this file, the README and `docs/` |

Write the subject in the present tense and keep it short, for example
`fix: clamp withdrawable to zero before a stream's cliff` rather than `fix bug`. Describe *why*
the change was made in the body when that is not obvious from the diff.

## Referencing issues

- In a commit message, add `Closes #<number>` on its own line when the commit completes an issue.
  Use `Refs #<number>` when the commit only contributes to one.
- In the pull request description, list each issue with `Closes #<number>` so GitHub links the
  PR to the issue and closes it on merge.
- If a change has no matching issue, leave the reference out rather than inventing one.

## Reporting issues

Please include: what you expected, what happened instead, your browser/Freighter version, and
which network (testnet/futurenet) you were connected to. Screenshots or a short recording help a
lot for anything involving `LiveBalance` or the create-stream flow.
