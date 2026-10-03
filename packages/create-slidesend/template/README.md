# Your first Slidesend talk

A talk that explains how it is made. Start it, then read `src/deck.ts` next to it.

```sh
npm run dev        # dev server with phones; prints the desk link
npm run check      # validates the deck
```

Open the desk link that `npm run dev` prints (with `#key=…`), and open the stage from the desk
(**Prepare → Join → Open the stage**). For phones on your network, open the desk with the
network address Vite prints instead of `localhost`, so the join code points at your machine.

`npm run check:render` and `npm run pdf` use a browser: run `npx playwright install chromium`
once before.

The documentation ships with the packages: `node_modules/@nxsflow/slidesend-core/docs/README.md`.
