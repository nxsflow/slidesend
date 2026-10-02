# Getting started

From an empty folder to a talk running in your browser, without a cloud account. The talk runs
in **local mode**: stage and desk in one browser, no audience. The last section adds phones,
still without a cloud account; [deploy-aws](../../aws/docs/deploy-aws.md) puts the talk online.

You need Node 24 and pnpm (npm works too; replace `pnpm add` with `npm install` and
`pnpm exec` with `npx`).

## 1. Get the packages

Once Slidesend is published on npm:

```sh
mkdir my-talk && cd my-talk
echo '{ "name": "my-talk", "private": true, "type": "module" }' > package.json
pnpm add @slidesend/core @slidesend/basics react react-dom zod
pnpm add -D vite typescript @types/react @types/react-dom
```

**Until the first release**, build the packages from the repository and install the tarballs
instead. Run this in an empty folder; it creates `slidesend/` (the clone), `tarballs/` and your
talk's folder `my-talk/` side by side. `aws` and `agent` are packed too, for
[deploy-aws](../../aws/docs/deploy-aws.md) and [agents](../../agent/docs/agents.md) later:

```sh
git clone https://github.com/nxsflow/slidesend.git
cd slidesend
pnpm install
pnpm build
for p in core basics aws agent; do (cd packages/$p && pnpm pack --pack-destination ../../../tarballs); done
cd ..
mkdir my-talk && cd my-talk
echo '{ "name": "my-talk", "private": true, "type": "module" }' > package.json
pnpm add ../tarballs/slidesend-core-0.0.0.tgz ../tarballs/slidesend-basics-0.0.0.tgz react react-dom zod
pnpm add -D vite typescript @types/react @types/react-dom
```

## 2. Write the deck

A deck is TypeScript. `src/deck.ts`:

```ts
import { list, section, statement } from "@slidesend/basics";
import { defineDeck } from "@slidesend/core";

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

## 3. Put the talk together

`presentation.config.ts` names the deck, exactly one design and the plugins whose nodes the deck
uses. A `platform` here (e.g. `aws(...)`) deploys the talk; without one it runs locally.

```ts
import { basics, defaultDesign } from "@slidesend/basics";
import { definePresentation } from "@slidesend/core";
import { deck } from "./src/deck";

export default definePresentation({
  deck,
  design: defaultDesign,
  plugins: [basics()],
});
```

`src/main.ts` mounts it:

```ts
import { mount } from "@slidesend/core";
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

## 4. Check and run it

```sh
pnpm exec slidesend check
```

prints `The deck is valid: 1 slides, 3 steps, 2 planned minutes.` A mistake in the deck is named
by slide id and field path instead. A slide without an `id` gets one from its chapter and
position, e.g. `intro-1` for the first slide of the chapter `intro`. Then:

```sh
pnpm exec slidesend dev
```

prints three links (the port is Vite's, 5173 unless taken; `--port` picks another). Open the
**desk** (`/desk`): it shows the deck and opens the stage in a new
window. On the stage, the arrow keys, space and the presenter remote step through the talk.
The first step of the hero section is its title alone; the panels follow one click each.

## 5. Phones, still without a cloud account

Local mode has no audience. The dev bridge runs Slidesend's server in memory inside the Vite
dev server, so phones on the same network can join. `vite.config.ts`:

```ts
import { slidesendDev } from "@slidesend/core/server";
import { defineConfig } from "vite";

export default defineConfig({
  plugins:
    process.env.VITE_SLIDESEND_PLATFORM === "dev"
      ? [slidesendDev({ defaultPlannedMinutes: 5 })]
      : [],
});
```

and in `src/main.ts`, hand the bridge's client to `mount`:

```ts
import { httpPlatformClient, mount } from "@slidesend/core";
import presentation from "../presentation.config";

const hosted = import.meta.env.VITE_SLIDESEND_PLATFORM === "dev";
mount(presentation, { platform: hosted ? httpPlatformClient() : undefined });
```

Start it with Vite directly, because phones need it to listen on the network (`--host`), which
`slidesend dev` does not offer:

```sh
VITE_SLIDESEND_PLATFORM=dev pnpm exec vite --host
```

Vite prints a desk link with the control secret after `#key=`, and the network address of your
machine (`Network: http://192.168.…`). Open the desk link with `localhost` replaced by that
network address: the **Join** card shows phones the address the desk was opened with. Create and
open a session in **Prepare**, then scan the code under Join with a phone. Everything lives in
memory and is gone when Vite stops. Plain `slidesend dev` still runs local mode.

To give the phones something to do, add a poll; its answers fill a matrix on the stage while
the phones answer. In `src/deck.ts`, add `pollMatrix` to the import from `@slidesend/basics`,
put `yesOrNo` and `panel` above the deck, and add `panel` as the third entry of the section's
`panels`:

```ts
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

## Editor support

Vite runs TypeScript without checking types. For an editor (and `pnpm exec tsc`) to check them,
install `@types/node` (`pnpm add -D @types/node`) and add a `tsconfig.json`:

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

## Next

- [writing-slides](writing-slides.md): chapters, steps, notes, timing and every node of
  `@slidesend/basics`.
- [design](design.md): your colors, fonts and logo.
- [plugins](plugins.md): nodes of your own.
- [sessions-and-desk](sessions-and-desk.md): rehearsals, live sessions and the review.
- [deploy-aws](../../aws/docs/deploy-aws.md): put the talk online.
- [`examples/gravity`](https://github.com/nxsflow/slidesend/tree/main/examples/gravity): a
  complete talk that uses all of it.
