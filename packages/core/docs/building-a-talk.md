# Building a talk with an agent

This page is for the coding agent that builds a talk together with its speaker, and for the
speaker who wants to know what the agent will ask. It goes through the work in order:
decisions first, then the project, the content, the design and, only where needed, templates
of the talk's own. The other pages explain each part in full and are linked from each section.

## 1. The decisions

A talk needs a few answers that only the speaker can give. Ask for them in one round before
writing slides, suggest a default for each, and write the answers down at the top of
`src/deck.ts` (or in the talk's `README.md`), so that a later session finds them. Never invent
facts, numbers or quotes for the content: ask, or leave a visible placeholder.

| Decision | Where it ends up | Default if the speaker has no preference |
|---|---|---|
| **Topic and message**: what the audience should take home, in one sentence | `meta.title`, `meta.subtitle`, the first and the last step | — always ask |
| **Audience and room**: who listens, how many, on site or online, how long the projector is theirs | tone, amount of text, how many questions | a room with a projector |
| **Length** in minutes | `meta.plannedMinutes`; `minutes` on every step | 20 |
| **Language** | `meta.language`; `messages` for the phone and desk strings ([messages](messages.md)) | `"en"` |
| **Storyline**: the three to six chapters, each with one sentence it argues | `chapters` (`title`, and the sentence as `claim`) | proposed by the agent, confirmed by the speaker |
| **Participation**: whether the audience answers on their phones, what and where | activities on steps; the `qr` slide | one question early, one per chapter |
| **Design**: brand colors, fonts, logo files | `src/tokens.ts`, `src/design.tsx`, `public/` | the starter design with the speaker's colors |
| **Own templates**: content the basics cannot show (code, a diagram that builds up, a live demo) | a plugin in the talk ([plugins](plugins.md)) | none |
| **Hosting**: only the speaker's network, or online | `npm run dev`, or the `--aws` variant ([deploy-aws](../../aws/docs/deploy-aws.md)) | local |
| **Audience agent**: may the audience ask an AI agent | `@slidesend/agent`; needs AWS and Amazon Bedrock ([agents](../../agent/docs/agents.md)) | no |
| **Paper**: a PDF of the talk or a storyboard for review | `print` rules on live-only steps | storyboard for review |

Phones can only answer while a session is open, and they reach it through the address the desk
was opened with: a talk that runs locally works for a room on the same network, a talk on AWS
for everybody.

## 2. Set up the talk

In the folder that should contain the talk:

```sh
npm create @slidesend@latest my-talk -- --yes          # local
npm create @slidesend@latest my-talk -- --yes --aws    # ready to deploy to AWS
cd my-talk
npm run dev                                            # prints the desk link
```

[getting-started](getting-started.md#3-what-you-got) lists the files. The starter talk is a
tutorial about itself; turn it into the speaker's talk:

1. In `src/deck.ts`, replace `meta`, `chapters` and `slides` with the speaker's. Keep the
   imports you use.
2. The starter's own block `code` shows this project's files. Keep it if the talk shows code;
   otherwise delete `src/plugin.tsx` and `src/sources.ts` and remove `starterPlugin` from
   `presentation.config.ts`.
3. Rename the design (`name` in `src/design.tsx`), replace `public/logo.svg` and
   `public/logo-mark.svg`, and delete `public/how-it-fits.svg` once no slide shows it.
4. Set `name` and `description` in `package.json`, and rewrite `README.md` for the talk.
5. `npm run check`.

Keep `AGENTS.md`: it points every later agent session at these docs. A talk in an existing
project is set up by hand: [getting-started](getting-started.md#appendix-a-talk-by-hand).

## 3. Structure the content

Write the storyline before the slides: the chapters, each with its one sentence, and the minutes
each one gets. Show it to the speaker and agree on it; then write one chapter at a time.

**One idea per slide, one thought per step.** A slide is usually a `section`: a title, then
panels, each panel one click. Open a chapter with a section with `hero: true`, which shows its
title large first. The slide shows a few words; what the speaker says goes into `notes`, on every
step. The desk shows the notes in large type next to the stage, so write them as the sentences
the speaker will say. Use `cue` for an action, e.g. "Wait for phones".

**Pick the block by what the content is:**

| The content is | Use |
|---|---|
| one claim | `statement` |
| a quotation | `quote` |
| a few parallel points | `list` (more than five items: split them over two steps) |
| points that should appear one by one | `reveal` |
| a sequence or a history | `timeline` |
| before and after | `diff` |
| a picture, chart or diagram | `image`, the file in `public/` |
| a question to the room | `poll` or `text` as the step's `activity` |
| the answers | `pollMatrix`, `pollList`, `textList`, on the same step or a later one |
| anything else | a block of the talk's own ([section 5](#5-add-a-template)) |

[writing-slides](writing-slides.md#the-nodes-of-slidesendbasics) lists every field, and
[the nodes of `@slidesend/basics`](../../basics/docs/nodes.md) shows each one.

**Participation.** Put the `qr` step early, while the room is settling, with a `cue` to wait.
Ask a question every few minutes, at the point where the answer changes what comes next. Give
every activity a `message`: the phone does not show the slide. Show the answers on the stage
right after, or keep them for the point where the talk returns to them (`of` a poll on a later
step). A step that only works with the room present says what paper shows instead
(`print: { replaceWith }` or `print: { hide: true }`).

**Timing.** Give every step `minutes`; the sum is the plan, and `npm run check` prints it.
Compare it with the agreed length, and shorten chapters rather than squeezing steps. After a
rehearsal, the desk's review shows what each step really took and can adopt it as the plan
([sessions-and-desk](sessions-and-desk.md#review)).

**Ids.** Give an `id` to every slide something refers to (`keep: { until }`, a later `of`), and
to every activity, because answers are stored by it.

## 4. Apply a design

A talk has exactly one design. The starter's lives in two files:

1. **Colors** in `src/tokens.ts`: all ten `base.color` values. Check contrast: `text` on
   `background` and `surface`, `onPrimary` on `primary`.
2. **Chapter accents**: `base.accents`, one per chapter by position; they color the progress bar
   and whatever reads `--slidesend-accent`.
3. **Phones**: `phone.color` overrides colors for the phones only, e.g. a dark background.
4. **Fonts**: put the font files in `public/`, list them in `fonts` of `defineDesign`, and name
   the families in `base.font` with a fallback stack ([design](design.md#fonts)).
5. **Logo**: the files in `public/`, placed in `StageFrame` (stage) and `PhoneFrame` (phones) in
   `src/design.tsx`.
6. **Phone pages**: the texts of `StartPage`, `ClosedPage` and `IdlePage`.

In every component, read colors, fonts and radii through their CSS variables
(`cssVariable("color", "text")`, `accentVariable`), never as literal values: that is what lets
every block fit every design. To keep the neutral default design and change only its colors,
spread `defaultDesign` ([design](design.md#tokens)). A design that several talks share is a
package of its own ([design](design.md#a-design-of-your-own-as-a-package)). After a change,
`npm run check:render` shows whether every step still fits the stage.

## 5. Add a template

Write a node of the talk's own only when no node of `@slidesend/basics` shows the content. Pick
the group by where it appears:

| It | Group | Defined with |
|---|---|---|
| fills one panel of a `section` | block — almost always this one | `defineBlock` |
| lays out the whole stage itself | slide template | `defineSlide` |
| runs on the phones | activity | `defineActivity` |

Then:

1. Write it in its own file in `src/`, e.g. `src/chart.tsx`: a `type` that no installed plugin
   uses yet, a Zod `schema` of its data, and the component. A block that builds up over several
   clicks also declares `steps` and `describe`
   ([plugins](plugins.md#a-block-that-builds-up-over-several-clicks)).
2. Style it with tokens only ([section 4](#4-apply-a-design)). Texts the component shows itself
   go into the plugin's `messages` and are read with `useText()`, so a talk in another language
   can translate them.
3. List it in the talk's plugin (`definePlugin` in `src/plugin.tsx`), and the plugin in
   `presentation.config.ts`.
4. Call its builder in `src/deck.ts`, like any other node.
5. `npm run check` validates its data in the deck; `npm run check:render` measures it on the
   stage.

[plugins](plugins.md) has a worked example of each group, coupled nodes and the server half of
an activity.

## 6. After every change

```sh
npm run check          # every problem by slide id and field path, and the planned length
npm run check:render   # every step on the 1920×1080 stage; what does not fit
npm run pdf            # the talk and a storyboard with every slide and its notes
```

Run `check` after every change and fix what it names before going on; run `check:render` after
changes to layout, design or a template. `check:render` and `pdf` need a browser once:
`npx playwright install chromium`. Hand the storyboard to the speaker for review, and suggest a
rehearsal in the desk (**Rehearse**) before the talk.
