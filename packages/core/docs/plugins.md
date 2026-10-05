# Plugins

A plugin is the installable unit: any number of slide templates, blocks and activities, plus
optional UI strings and an optional server half. Write one when the talk needs something that
`@slidesend/basics` does not have. Nothing is discovered from folders and nothing registers
itself; a talk lists its plugins in `presentation.config.ts`.

Every node is defined with one function per group (`defineSlide`, `defineBlock`,
`defineActivity`), in one file per node, from three required fields: `type`, a Zod `schema`, and
the component. The result is both the definition the plugin lists and the typed builder the
deck calls.

## A block

The starter talk (`npm create @slidesend`) brings a block of its own: a piece of the
project's source code on the stage. A type, a Zod schema of its data, and a React component:

<!-- snippet: packages/create/template/src/plugin.tsx#code-block -->
```tsx
/** A block of this talk's own: a piece of this project's source code, on the stage. */
export const code = defineBlock({
  type: "code",
  schema: z.object({
    file: z.string(), // e.g. "src/deck.ts"
    region: z.string().optional(), // the name after "// snippet:" in that file
    caption: z.string().optional(),
  }),
  Component: ({ data }) => <CodeView {...data} />,
});
```
<!-- end snippet -->

The component gets the node's `data`, validated and with defaults applied. The deck calls the
block like any other:

<!-- snippet: packages/create/template/src/deck.ts#use-code-block -->
```ts
{
  content: code({
    file: "src/plugin.tsx",
    region: "code-block",
    caption: "The block that shows this code",
  }),
  notes: "A type, a Zod schema, a React component. The plugin lists it; the deck calls it.",
  minutes: 1.5,
},
```
<!-- end snippet -->

### A block that builds up over several clicks

The example talk `examples/gravity` draws the Moon's orbit in three clicks. `steps` says how many
clicks the block takes, `describe` hands each step's fields to the desk, and the component gets
the current `step`:

<!-- snippet: examples/gravity/src/plugin.tsx#define-block -->
```tsx
export const orbit = defineBlock({
  type: "orbit",
  schema: z.object({
    captions: z.array(z.object({ text: z.string(), ...stepMeta })).length(3),
  }),
  steps: (data) => data.captions.length,
  describe: (data) => ({
    label: "Orbit",
    steps: data.captions.map(({ text: _text, ...meta }) => meta),
  }),
  Component: ({ data, step }) => (
    <figure style={{ margin: 0, display: "grid", gap: 24, justifyItems: "center" }}>
      <svg
        viewBox="0 0 520 380"
        width={1080}
        role="img"
        aria-label="The Moon falls towards the Earth and keeps missing it"
      >
        <title>The Moon falls towards the Earth and keeps missing it</title>
        {/* The Earth is there from the first click; everything else answers it. */}
        <circle cx="260" cy="190" r="54" fill={token.accent} />
        {step >= 1 && (
          <g data-fall>
            <line
              x1="260"
              y1="190"
              x2="430"
              y2="190"
              stroke={token.muted}
              strokeWidth="4"
              strokeDasharray="10 10"
            />
            <circle cx="430" cy="190" r="18" fill={token.text} />
          </g>
        )}
        {step >= 2 && (
          <ellipse
            data-path
            cx="260"
            cy="190"
            rx="170"
            ry="170"
            fill="none"
            stroke={token.text}
            strokeWidth="3"
            opacity="0.7"
          />
        )}
      </svg>
      <figcaption data-caption style={{ fontSize: 40, color: token.muted, margin: 0 }}>
        {data.captions[Math.min(step, data.captions.length - 1)]?.text}
      </figcaption>
    </figure>
  ),
});
```
<!-- end snippet -->

The deck gives each click its caption and minutes:

<!-- snippet: examples/gravity/src/deck.ts#own-block -->
```ts
{
  // The talk's own block, built in three clicks: what a plugin is for.
  content: orbit({
    captions: [
      { text: "The Earth pulls." },
      { text: "So the Moon falls towards it.", minutes: 0.4 },
      { text: "And moves sideways fast enough to keep missing.", minutes: 0.4 },
    ],
  }),
  minutes: 0.4,
  notes: "Three clicks: the pull, the fall, the miss.",
},
```
<!-- end snippet -->

Use design tokens for every color, font and radius, never a literal: a block from one talk must
look right in another talk's design. `cssVariable("color", "text")` names a token's CSS
variable, `--slidesend-accent` is the current chapter's accent; [tokens](tokens.md) lists them
all.

## A slide template

A slide template owns the whole 1920×1080 stage: layout and every animation, including how the
slide appears and leaves. This one puts a title on the left and one block on the right:

```tsx
import { Block, blockSlot, cssVariable, defineSlide, stepMeta } from "@slidesend/core";
import { z } from "zod";

export const split = defineSlide({
  type: "split",
  schema: z.object({
    title: z.string(),
    content: blockSlot(),
    ...stepMeta,
  }),
  Component: ({ data, presence }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 96,
        alignItems: "center",
        height: "100%",
        padding: 120,
        opacity: presence === "leaving" ? 0 : 1,
        transition: "opacity 400ms",
      }}
    >
      <h1 style={{ fontFamily: `var(${cssVariable("font", "display")})`, fontSize: 96 }}>
        {data.title}
      </h1>
      <Block node={data.content} />
    </div>
  ),
});
```

`blockSlot()` accepts a block of any installed plugin and validates it against that block's
schema. `...stepMeta` gives the slide the step fields (`notes`, `minutes`, `activity`, …); with a
single step, the default `describe` reads them from the top level. A template whose slots build
up asks its context for their steps: `steps: (data, { stepsOf }) => stepsOf(data.content)`, and
passes the step on to `<Block node={...} step={...} />`. The `section` template of
`@slidesend/basics` does exactly that for its panels.

The component receives `data`, `step`, `previousStep`, `direction` (`"forward"` or
`"backward"`) and `presence` (`"entering"`, `"present"` or `"leaving"`). Core keeps a leaving
slide mounted for `leaveMs` (the design's default unless the template sets its own) so it can
animate its exit. An optional `Print` component renders the slide on paper.

## An activity

An activity is what the phones show while its step runs. Simple activities need no backend code
of their own: core hands them a response store scoped to the session, the activity and the
device.

```tsx
import { activityMeta, defineActivity, useResponses, useResponseStore } from "@slidesend/core";
import { useState } from "react";
import { z } from "zod";

export const rating = defineActivity({
  type: "rating",
  schema: z.object({ id: z.string(), question: z.string(), ...activityMeta }),
  Participant: ({ data }) => {
    const store = useResponseStore();
    const [sent, setSent] = useState<number>();
    return (
      <div>
        <p>{data.question}</p>
        {[1, 2, 3, 4, 5].map((stars) => (
          <button
            key={stars}
            type="button"
            aria-pressed={sent === stars}
            onClick={() => store?.write(stars).then(() => setSent(stars))}
          >
            {stars}
          </button>
        ))}
      </div>
    );
  },
  Monitor: ({ data }) => <span>{useResponses(data.id).length} ratings</span>,
});
```

- `...activityMeta` adds `message` and `keep` ([writing-slides](writing-slides.md#activities-that-stay)).
- `useResponseStore()` writes a response (`write`), reads the device's own (`mine`) and follows
  all of them (`follow`). It is `undefined` in local mode, where no phone exists.
- `useResponses(id)` follows every response of an activity, for a stage block or the desk tile.
- `Monitor` is the optional live tile in the desk's speaker view.

The server enforces the session: outside an open session every write is refused, a text response
is at most 500 characters and any other value at most 1000 as JSON, and one device sends at most
50 responses to an activity.

An activity that needs its own backend, such as the agent chat, ships a server factory in its
package's `./server` entry. The talk calls it in its `aws-blocks/index.ts` with the backend's
platform and guards, and exports the API namespace it returns. Every method that can cost money
runs behind `session(guards, method)` from `@slidesend/core/server`, which calls
`guards.requireOpenSession(sessionId)` first. `@slidesend/agent` is the worked example
([agents](../../agent/docs/agents.md)); [hosting-adapters](hosting-adapters.md) describes the
platform side.

## Coupled nodes

A block may contribute an activity to its step through its `describe`. That is how `pollMatrix`
asks on the phones and shows the answers on the stage in one node, and why a deck can also split
the two (`poll` on one step, `pollMatrix({ of })` later). A reference to another node is a
schema field: `activityRef()`, `slideRef()`, or `ref("<kind>")` for ids a plugin provides,
resolved when the deck loads.

## The plugin

```ts fragment
import { definePlugin } from "@slidesend/core";

export const myPlugin = definePlugin({
  name: "my-talk",
  slides: [split],
  blocks: [orbit],
  activities: [rating],
  messages: { en: { "myTalk.thanks": "Thanks!" } },
});
```

and in `presentation.config.ts`: `plugins: [basics(), myPlugin]`. A type may exist only once
across all installed plugins. `messages` are the plugin's UI strings by language; a component
reads them with `useText()`, and a talk overrides them like core's own.

## Testing a plugin

A plugin is tested like the example talk tests its own: `slidesend check` validates a deck that
uses every node, `slidesend check --render` measures every step on the stage, and the browser
checks exported from `@slidesend/core/checks` run the stage and lock tests against it.
