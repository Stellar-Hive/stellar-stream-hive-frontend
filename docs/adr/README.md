# Architecture decision records

Short records of decisions that are not obvious from the code alone. Each ADR states the
context, the decision and its consequences, and points to the code that implements it.

To add one, copy [`0000-template.md`](./0000-template.md) to the next free number
(`NNNN-short-title.md`), fill it in, and link it from the index below.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-bigint-amounts.md) | Token amounts are BigInt end to end | Accepted |
| [0002](./0002-status-derived-from-ledger.md) | Stream status is derived from the ledger | Accepted |
| [0003](./0003-refetch-withdrawable-before-withdraw.md) | Re-fetch the withdrawable amount before withdrawing | Accepted |
