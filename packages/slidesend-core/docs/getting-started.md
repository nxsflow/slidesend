# Getting started

One command creates a talk that runs on your machine, with phones from your network, and no
cloud account. The talk explains how it is made: read its `src/deck.ts` next to it.
[deploy-aws](../../slidesend-aws/docs/deploy-aws.md) puts it online later.

You need Node 24. npm, pnpm, yarn and bun all work; the examples use npm.

## 1. Create the talk

```sh
npm create @nxsflow/slidesend@latest my-talk
```

creates `./my-talk`, installs it and prints what to do next. Without a name it asks for one.

| Option | Effect |
|---|---|
| `--aws` | the variant that deploys to AWS: backend, Blocks config and deploy scripts included |
| `--yes` | ask nothing (the name defaults to `my-talk`) |
| `--no-install` | write the files, install nothing |
| `--package-manager <pm>` | install with npm, pnpm, yarn or bun instead of the one running the command |

With npm, options go after `--`: `npm create @nxsflow/slidesend@latest my-talk -- --aws`.

**Until the first release**, build the packages from the repository and run the command from its
tarball instead. This needs `git` and `pnpm` as well; the build takes a few minutes. In an empty
folder:

```sh
git clone https://github.com/nxsflow/slidesend.git
cd slidesend
pnpm install
pnpm build
for p in slidesend-core slidesend-basics slidesend-aws slidesend-agent create-slidesend; do (cd packages/$p && pnpm pack --pack-destination ../../../packs); done
cd ..
SLIDESEND_CREATE_TARBALLS=$PWD/packs npx --yes --package ./packs/nxsflow-create-slidesend-0.0.0.tgz create-slidesend my-talk
```

`SLIDESEND_CREATE_TARBALLS` makes the new talk install the packed packages instead of the
released ones. Its `package.json` then points at the files in `packs/` by absolute path, so keep
that folder where it is for as long as you reinstall.

## 2. Run it

```sh
cd my-talk
npm run dev
```

starts the dev server and prints two desk links that end in `#key=…`: one with `localhost`, one
with your machine's network address. The key is the control secret: the browser that opens such
a link may steer the talk. Then:

1. Open the desk link. The desk shows the notes, the cue, what comes next and the clock.
2. **Prepare**: create a session and open it. Phones take part only while a session is open.
3. **Join → Open the stage**: the stage opens in a new window, already allowed to follow the
   session. Put it on the projector; the arrow keys, space and a presenter remote step through it.
4. Phones scan the code on the stage, or open the address under Join. For that, use the desk
   link **for phones on this network**: the join code points at the address the desk was opened
   with, and phones cannot reach `localhost`.

Everything lives in memory and is gone when the dev server stops. With `--aws`, `npm run dev`
starts the AWS Blocks dev server instead, with local mocks of the backend; it needs no AWS
account either.

## 3. What you got

| File | What it is |
|---|---|
| `presentation.config.ts` | puts deck, design and plugins together |
| `src/deck.ts` | the slides |
| `src/tokens.ts`, `src/design.tsx` | colors, fonts, the frames around stage and phone, the logo |
| `src/plugin.tsx`, `src/sources.ts` | a block of the talk's own: code on the stage |
| `src/main.ts`, `index.html`, `vite.config.ts` | mount the talk in the browser, with the dev bridge |
| `public/` | logos and pictures |
| `AGENTS.md` | tells coding agents where these docs are |
| `README.md`, `tsconfig.json`, `.gitignore`, `package.json` | the usual project files; the scripts are in `package.json` |

The config lists every plugin the deck uses, and exactly one design:

<!-- snippet: packages/create-slidesend/template/presentation.config.ts#presentation -->
```ts
export default definePresentation({
  deck,
  design: starterDesign,
  // Every node type the deck uses comes from one of these plugins.
  plugins: [basics(), starterPlugin],
});
```
<!-- end snippet -->

`npm run dev` runs Vite in the mode `bridge`, which adds Slidesend's dev bridge, the server
running in memory, so phones can join:

<!-- snippet: packages/create-slidesend/template/vite.config.ts#vite -->
```ts
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "bridge" ? [slidesendDev({ defaultPlannedMinutes: 18 })] : [])],
}));
```
<!-- end snippet -->

and the page then talks to the bridge:

<!-- snippet: packages/create-slidesend/template/src/main.ts#main -->
```ts
// In the mode "bridge" (`npm run dev`) the page talks to the dev bridge; otherwise local mode.
const bridge = import.meta.env.MODE === "bridge";
mount(presentation, { platform: bridge ? httpPlatformClient() : undefined });
```
<!-- end snippet -->

## 4. Change it

Every slide is a node in `src/deck.ts`. This is the slide of the starter talk that shows its own
code:

<!-- snippet: packages/create-slidesend/template/src/deck.ts#this-slide -->
```ts
section({
  id: "steps",
  chapter: "slides",
  title: "A slide is a node",
  panels: [
    {
      content: code({ file: "src/deck.ts", region: "this-slide", caption: "This very slide" }),
      notes: "Everything in a deck is a node: { type, ...data }. section() builds one.",
      minutes: 1,
    },
    {
      content: reveal({
        items: [
          { text: "Every click is a **step**", minutes: 0.3 },
          { text: "A step has notes, a cue and planned minutes", minutes: 0.3 },
          { text: "The desk adds the minutes up to a plan", minutes: 0.3 },
        ],
      }),
      cue: "Three clicks",
    },
  ],
}),
```
<!-- end snippet -->

Save, and the browser updates. Then:

```sh
npm run check          # validates the deck; names every problem by slide id and field path
npm run check:render   # also opens every step on the stage and reports what does not fit
npm run pdf            # the talk and a storyboard (every slide with its notes) as PDFs
```

These scripts run the `slidesend` command (`npm run check` is `npx slidesend check`); AGENTS.md
uses the latter. `check:render` and `pdf` use a browser: run `npx playwright install chromium`
once. They start their own dev server, take about half a minute, and print "Port 5173 is in use"
when another one is running — harmless. A slide
without an `id` gets one from its chapter and position, e.g. `intro-1`; give an id to every slide
something refers to.

## 5. Where next

- [writing-slides](writing-slides.md): chapters, steps, notes, timing and every node of
  `@nxsflow/slidesend-basics`.
- [design](design.md): your colors, fonts and logo.
- [plugins](plugins.md): nodes of your own.
- [sessions-and-desk](sessions-and-desk.md): rehearsals, live sessions and the review.
- [deploy-aws](../../slidesend-aws/docs/deploy-aws.md): put the talk online.
- [`examples/gravity`](https://github.com/nxsflow/slidesend/tree/main/examples/gravity): a
  complete talk with an agent, deployed to AWS.

## Appendix: a talk by hand

What the starter does, in four files, for those who want to see every piece. In an empty folder
with the packages installed (`npm install @nxsflow/slidesend-core @nxsflow/slidesend-basics react
react-dom zod` and `npm install -D vite typescript @types/react @types/react-dom`):

### Write the deck

A deck is TypeScript. `src/deck.ts`:

```ts file=src/deck.ts
import { list, section, statement } from "@nxsflow/slidesend-basics";
import { defineDeck } from "@nxsflow/slidesend-core";

export const deck = defineDeck({
  meta: { title: "My first talk", language: "en", plannedMinutes: 5 },
  chapters: [{ id: "intro", title: "Hello" }],
  slides: [
    section({
      chapter: "intro",
      title: "My first talk",
      hero: true,
      panels: [
        { content: statement({ text: "Slides as **code**." }), minutes: 1 },
        { content: list({ items: ["One deck", "One design", "Any plugins"] }), minutes: 1 },
      ],
    }),
  ],
});
```

### Put the talk together

`presentation.config.ts` names the deck, exactly one design and the plugins whose nodes the deck
uses. A `platform` here (e.g. `aws(...)`) deploys the talk; without one it runs locally.

```ts file=presentation.config.ts
import { basics, defaultDesign } from "@nxsflow/slidesend-basics";
import { definePresentation } from "@nxsflow/slidesend-core";
import { deck } from "./src/deck";

export default definePresentation({
  deck,
  design: defaultDesign,
  plugins: [basics()],
});
```

`src/main.ts` mounts it:

```ts file=src/main.ts
import { mount } from "@nxsflow/slidesend-core";
import presentation from "../presentation.config";

mount(presentation);
```

and `index.html` loads that:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My first talk</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### Check and run it

```sh
npx slidesend check
```

prints `The deck is valid: 1 slides, 3 steps, 2 planned minutes.` A mistake in the deck is named
by slide id and field path instead. A slide without an `id` gets one from its chapter and
position, e.g. `intro-1` for the first slide of the chapter `intro`. Then:

```sh
npx slidesend dev
```

prints three links (the port is Vite's, 5173 unless taken; `--port` picks another). Open the
**desk** (`/desk`): it shows the deck and opens the stage in a new
window. On the stage, the arrow keys, space and the presenter remote step through the talk.
The first step of the hero section is its title alone; the panels follow one click each.

### Phones, still without a cloud account

Local mode has no audience. The dev bridge runs Slidesend's server in memory inside the Vite
dev server, so phones on the same network can join. `vite.config.ts`:

```ts file=vite.config.ts
import { slidesendDev } from "@nxsflow/slidesend-core/server";
import { defineConfig } from "vite";

export default defineConfig({
  plugins:
    process.env.VITE_SLIDESEND_PLATFORM === "dev"
      ? [slidesendDev({ defaultPlannedMinutes: 5 })]
      : [],
});
```

and in `src/main.ts`, hand the bridge's client to `mount`:

```ts file=src/main.ts
import { httpPlatformClient, mount } from "@nxsflow/slidesend-core";
import presentation from "../presentation.config";

const hosted = import.meta.env.VITE_SLIDESEND_PLATFORM === "dev";
mount(presentation, { platform: hosted ? httpPlatformClient() : undefined });
```

Start it with Vite directly, because phones need it to listen on the network (`--host`), which
`slidesend dev` does not offer:

```sh
VITE_SLIDESEND_PLATFORM=dev npx vite --host
```

Vite prints a desk link with the control secret after `#key=`, and the network address of your
machine (`Network: http://192.168.…`). Open the desk link with `localhost` replaced by that
network address: the **Join** card shows phones the address the desk was opened with. Create and
open a session in **Prepare**, then scan the code under Join with a phone. Everything lives in
memory and is gone when Vite stops. Plain `slidesend dev` still runs local mode.

To give the phones something to do, add a poll; its answers fill a matrix on the stage while
the phones answer. In `src/deck.ts`, add `pollMatrix` to the import from `@nxsflow/slidesend-basics`,
put `yesOrNo` and `panel` above the deck, and add `panel` as the third entry of the section's
`panels`:

```ts
import { pollMatrix } from "@nxsflow/slidesend-basics";

const yesOrNo = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

const panel = {
  content: pollMatrix({
    id: "mood",
    message: "Two quick questions.",
    questions: [
      { id: "tea", text: "Do you drink tea?", short: "Tea", options: yesOrNo },
      { id: "early", text: "Are you an early bird?", short: "Early", options: yesOrNo },
    ],
  }),
  minutes: 1,
  // A live result means nothing on paper; see "Print" in writing-slides.
  print: { hide: true },
};
```

`slidesend check` insists on the print rule: without it, `slidesend pdf` would print an empty
matrix as if the room had never answered.

### Editor support

Vite runs TypeScript without checking types. For an editor (and `npx tsc`) to check them,
install `@types/node` (`npm install -D @types/node`) and add a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "presentation.config.ts", "vite.config.ts"]
}
```
