# Your first Slidesend talk

A talk that explains how it is made. Start it, then read `src/deck.ts` next to it.

Slidesend is made to be written with an AI coding agent: open this folder in yours and ask it
for the talk you want, e.g. "Add a slide after ‘Questions for the room’ with a poll about …".
`AGENTS.md` points the agent to the documentation that ships in `node_modules`: it starts
with `building-a-talk.md`, asks you for the decisions only you can make (message, audience,
length, language, storyline, questions for the room, design, hosting), then writes the slides. `npm run check`
names every mistake by slide and field, so the agent can fix it.

```sh
npm run dev        # dev server with phones; prints the desk link
npm run check      # validates the deck
```

Open the desk link that `npm run dev` prints (with `#key=…`), and open the stage from the desk
(**Rehearse**, then **Open the stage**). For phones, use the desk link "for phones on this
network": the join code points at the address the desk was opened with.

`npm run check:render` and `npm run pdf` use a browser: run `npx playwright install chromium`
once before.

The documentation ships with the packages: `node_modules/@slidesend/core/docs/README.md`.
