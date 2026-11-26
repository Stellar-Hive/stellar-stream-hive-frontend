# README screenshots (Issue #109)

PNG screenshots of the app's main screens, referenced from the root `README.md`'s
Screenshots section.

## Capturing a screenshot

1. Run the app against **testnet** (`NEXT_PUBLIC_STELLAR_NETWORK=testnet`, see the root
   README's Environment variables section) with a **test wallet that holds no real funds**.
2. Never capture a real Stellar address, real balance, or real transaction hash. Use a
   throwaway testnet account for every shot.
3. Export as PNG, then compress until the file is under ~300 KB (e.g. `pngquant` or any
   lossless-PNG optimizer) before committing it here.

## Expected files

| File                                 | Screen                                                              | Source page                 |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------- |
| `receiving-balance.png`              | The live, ticking balance counter (the product's signature feature) | `app/receiving/page.tsx`    |
| `streams-new.png`                    | The create-stream form                                              | `app/streams/new/page.tsx`  |
| `sending-list.png`                   | The list of streams an account is sending                           | `app/sending/page.tsx`      |
| `stream-detail.png` _(optional 4th)_ | A single stream's detail view                                       | `app/streams/[id]/page.tsx` |

Keep this table in sync with `README.md`'s Screenshots section if a filename changes.
