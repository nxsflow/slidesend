# Writing slides

A deck is TypeScript, written with `defineDeck`, typed from the installed plugins and validated
when the talk loads. This page covers the deck, its chapters, the nodes in it, their steps and
the timing. [getting-started](getting-started.md) shows where the deck sits in a talk project.

## The deck

```text
Deck     { meta, chapters, slides }
Meta     { title, subtitle?, author?, language, plannedMinutes? }
Chapter  { id, title, tab?, claim?, minutes? }
```

- `language` is a BCP 47 tag such as `"en"` or `"de-DE"`. It selects the UI strings phones and
  desk show; see [UI strings](#ui-strings).
- A deck has any number of chapters. A chapter's accent color comes from the design, by position.
- There are **no clock times** in a deck. Time is a duration in `minutes`; clock times belong to
  a session ([sessions-and-desk](sessions-and-desk.md)).

## Nodes

Everything in a deck is a node: `{ type, ...data }`. The type decides which data is allowed,
how it renders, how many steps it takes and how it animates. There are three groups:

| Group | Appears | Examples |
|---|---|---|
| slide | directly in `deck.slides`; owns the whole stage | `section` |
| block | in a slot a slide template offers, e.g. a panel's `content` | `statement`, `list`, `pollMatrix` |
| activity | attached to a step as `activity`; shown on the phones | `poll`, `text`, `agentChat` |

A node is written with its builder, which is typed from its schema:
`section({ chapter: "intro", title: "Hello" })`. A slide node also carries `chapter`, and an
optional stable `id`. Without an `id`, one is derived from the chapter and the position; give
an id to every slide that something refers to, because a derived id changes when slides move.

This is the opening section of the example talk: a hero title, then three panels, one of which
asks the phones a question.

<!-- snippet: examples/gravity/src/deck.ts#hero-slide -->
```ts
section({
  id: "why",
  chapter: "intro",
  title: "How does gravity work?",
  subtitle: "A talk in which you answer too",
  hero: true,
  notes: "Welcome the class.",
  minutes: 0.5,
  panels: [
    {
      content: statement({ text: "Everything falls — **even the Moon**." }),
      centered: true,
      minutes: 0.5,
    },
    {
      content: qr({ caption: "Answer on your phone" }),
      centered: true,
      cue: "Wait for phones",
      // On paper a code into a session that is over shows nothing; the question does.
      minutes: 1,
      print: {
        replaceWith: statement({ text: "**Hammer or feather** — which one lands first?" }),
        text: "The room answered this on their phones before we went on.",
      },
      activity: text({
        id: "guess",
        prompt: "What falls faster: a hammer or a feather?",
        message: "The talk has just started — take a guess.",
        keep: { until: "together" },
      }),
    },
    {
      content: list({
        items: [
          "An apple drops from a tree.",
          "The Moon circles the Earth.",
          "The tides rise and fall.",
        ],
      }),
      minutes: 1,
    },
  ],
}),
```
<!-- end snippet -->

## Steps

A click on the stage moves one **step**. A node says how many steps it takes; the `section`
above takes four: the hero title, then one per panel. A block that builds up over several
clicks (`reveal`, or the example's own `orbit`) adds its steps to the panel it sits in.

Wherever a step originates, it takes the same fields (`stepMeta`):

| Field | Meaning |
|---|---|
| `notes` | Speaker notes, shown large in the desk. |
| `cue` | A short, highlighted instruction for the speaker, e.g. "Wait for phones". |
| `minutes` | Planned duration of this step. |
| `activity` | The activity the phones show while this step runs. |
| `print` | How the step appears on paper: `hide`, `keep`, `replaceWith`, `text`. |

On a `section`, the top-level fields describe the hero step and each panel's fields describe
its own first step. On `reveal`, each item is a step.

### Activities that stay

An activity normally ends with its step. `keep: true` keeps it on the phones for the rest of the
talk; `keep: { until: "together" }` keeps it until the slide with the id `together`. Every
activity also takes `message`: one sentence of context, because the phone does not show the
slide.

### Coupled nodes

A poll can be asked and shown in one node, or asked on one step and shown later:

```ts fragment
// one node does both: a matrix on the stage, two questions on the phones
content: pollMatrix({ id: "mood", questions: [q1, q2] })

// or split: ask on one step, show on a later one
activity: poll({ id: "mood", questions: [q1, q2] })
content:  pollMatrix({ of: "mood" })
```

`of` is a reference: a deck whose `of` names no activity does not load.

## Timing

The plan is the sum of `minutes` over all steps. `slidesend check` prints it, the desk compares
it with the length of a session, and the stage clock in the desk measures against it while you
talk. A rehearsal measures how long each step really took; the desk can adopt that measurement
as the plan or hand it to an agent to write back into the deck
([sessions-and-desk](sessions-and-desk.md#review)).

## Print

`slidesend pdf` writes the talk and a storyboard (every slide with its notes) as PDFs. A slide
that builds up prints in its final state unless a step says `print: { keep: true }`. A block
that only works while the room is there, such as a QR code into the session, must say what paper
shows instead, with `print: { replaceWith: ... }` or `print: { hide: true }`; `slidesend check`
fails otherwise. `print: { text }` replaces the notes under a printed step.

## Validation

`definePresentation` validates the whole deck when it loads, and `slidesend check` does the same
on the command line, in CI and in a pre-commit hook:

- every node passes its type's schema, and every node type comes from an installed plugin;
- slide ids and chapter ids are unique, and every reference resolves (`chapter`, `of`,
  `keep.until`, `agent`);
- every step prints as it was shown (see Print).

Every problem is named by slide id and field path. `slidesend check --render` also opens every
step on the 1920×1080 stage in a browser and reports what does not fit.

## The nodes of `@slidesend/basics`

`basics()` installs all of them. Text fields accept `**bold**`, `*emphasis*` and a newline for
a line break.

| Node | Group | What it is |
|---|---|---|
| `section` | slide | Title, optional subtitle, and panels that move like a carousel. `hero: true` opens with the title large and centered. A panel has `content` (one block), `centered`, and the step fields. |
| `statement` | block | One sentence, `size: "large"` or `"medium"`. |
| `quote` | block | A quotation with an optional `source`. |
| `list` | block | Bullet or numbered `items`; long lists stand in two columns. |
| `reveal` | block | A list whose `items` appear one click at a time; each item takes the step fields. |
| `timeline` | block | Two or more `entries` with `label` and `text`. |
| `diff` | block | `before` and `after` side by side, with an optional `number`. |
| `image` | block | `src`, `alt` (required), `caption`, `fit`. Put files in the project's `public/`. |
| `qr` | block | The join code of the running session. Live only: say what paper shows. |
| `pollMatrix` | block | Two poll questions counted against each other. Inline (`id`, `questions`) or `of` a poll. |
| `pollList` | block | A poll's answers as bars, one group per question. Inline or `of` a poll. |
| `textList` | block | Answers to a `text` activity, newest first: `of`, `limit` (default 8). |
| `poll` | activity | One to four questions with two to eight `options` each. A question's `short` labels a matrix axis. |
| `text` | activity | A free-text `prompt`; `multiple: true` lets one phone answer several times. |
| `wait` | activity | A line of `text` for the phones while nothing is asked. |
| `link` | activity | A button to `url` with a `label`, an optional `hint` and `privacy` line. |

Answers are limited to 500 characters each. The agent chat (`agentChat`) comes from
`@slidesend/agent`; see [agents](../../agent/docs/agents.md).

## UI strings

Core and plugins ship English strings for phone and desk. A talk in another language overrides
them with `messages` in `presentation.config.ts`, by language and key:

```ts fragment
export default definePresentation({
  deck,
  design: defaultDesign,
  plugins: [basics()],
  messages: { de: { "core.desk.start.rehearse": "Proben" } },
});
```

[messages](messages.md) lists every key. An override of a key that no installed package has is
a validation error.
