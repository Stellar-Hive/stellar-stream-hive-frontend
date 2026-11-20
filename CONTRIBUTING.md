# Contributing to Stellar Stream Hive (Frontend)

Thanks for your interest in contributing! This repo is the Next.js frontend for Stellar Stream
Hive. Contributions of all sizes are welcome — bug fixes, new components, accessibility
improvements, documentation, and design polish.

By participating in this project you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Repository layout

See the "Project structure" section of [`README.md`](./README.md) for a map of `app/`,
`components/`, `hooks/`, and `lib/`.

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

### Pre-commit checks

`npm install` sets up a Git pre-commit hook (via [husky](https://typicode.github.io/husky/)).
On each commit it runs [lint-staged](https://github.com/lint-staged/lint-staged), which only
touches the files you staged:

- ESLint with `--fix` on staged `.ts`, `.tsx`, `.js`, `.jsx` and `.mjs` files
- Prettier on staged code, JSON, Markdown and CSS files

Run the same format check CI runs with `npm run format:check`, or fix formatting with
`npm run format`.

To commit without the hook (for example, while rebasing), set `HUSKY=0` for that command:
`HUSKY=0 git commit -m "..."`.

You'll need the [Freighter](https://www.freighter.app/) browser extension to exercise
wallet-connected flows locally, set to **Testnet**.

Contract-calling features (create/withdraw/cancel a stream) require
`NEXT_PUBLIC_STREAM_CONTRACT_ID` (and friends) to point at a real deployed contract. If you're
only working on UI/UX that doesn't touch live contract state, you can leave these unset — the
app will show a clear "not yet configured" state rather than erroring.

### Dev container (optional)

If you use VS Code or GitHub Codespaces, `.devcontainer/devcontainer.json` gives you a ready
environment: Node 20 (matching `.nvmrc`), `npm ci` run on create, port 3000 forwarded to the
Next.js dev server, and the recommended editor extensions from `.vscode/extensions.json`.
Open the repo and choose **Reopen in Container**.

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
   sender and a recipient account. Fund each one with Friendbot at
   `https://friendbot.stellar.org/?addr=<PUBLIC_KEY>`. Friendbot only works on testnet, so never
   use a mainnet key here.
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

## Commit style

Use clear, present-tense commit messages describing _why_ a change was made where it's not
obvious from the diff (e.g. `fix: clamp withdrawable to zero before a stream's cliff` rather
than `fix bug`).

## Reporting issues

Please include: what you expected, what happened instead, your browser/Freighter version, and
which network (testnet/futurenet) you were connected to. Screenshots or a short recording help a
lot for anything involving `LiveBalance` or the create-stream flow.
