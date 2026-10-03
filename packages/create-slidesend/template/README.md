# Your first Slidesend talk

A talk that explains how it is made. Start it, then read `src/deck.ts` next to it.

```sh
npm run dev        # dev server with phones; prints the desk link
npm run check      # validates the deck
```

Open the desk link that `npm run dev` prints (with `#key=…`), and open the stage from the desk
(**Prepare → Join → Open the stage**). For phones, use the desk link "for phones on this
network": the join code points at the address the desk was opened with.

`npm run check:render` and `npm run pdf` use a browser: run `npx playwright install chromium`
once before.

The documentation ships with the packages: `node_modules/@nxsflow/slidesend-core/docs/README.md`.
