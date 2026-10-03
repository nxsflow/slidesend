# Design

A design gives a talk its colors, fonts and logo without touching a template. A presentation has
exactly one: `design` in `presentation.config.ts`. `@slidesend/basics` ships `defaultDesign`, a
neutral one with system fonts and an empty logo slot.

## What a design is

```text
defineDesign({
  name,
  tokens: { base, stage?, phone? },   // colors, fonts, radii, chapter accents
  fonts?,                             // @font-face files
  leaveMs?,                           // how long a leaving slide stays mounted
  StageFrame, PhoneFrame,             // the chrome around stage and phone
  StartPage, ClosedPage, IdlePage,    // the three phone pages
})
```

`defineDesign` throws if a token or a component is missing and names each one, e.g.
`missing tokens.base.color.focus`.

This is the design of the starter talk (`npm create @slidesend`). Its values live in
`src/tokens.ts`, the components in `src/design.tsx`:

<!-- snippet: packages/create/template/src/design.tsx#design -->
```tsx
export const starterDesign = defineDesign({
  name: "starter",
  tokens,
  StageFrame: ({ progress, frame, children }) => (
    <>
      {children}
      {/* The logo is large while a hero title is centered, small otherwise. */}
      <img
        src="/logo.svg"
        alt=""
        style={{
          position: "absolute",
          top: 48,
          right: 64,
          height: frame.heroTitle ? 120 : 56,
          transition: "height 600ms",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 10,
          width: `${((progress.index + 1) / progress.total) * 100}%`,
          background: accent,
          transition: "width 400ms",
        }}
      />
    </>
  ),
  PhoneFrame: ({ chapter, children }) => (
    <div style={{ minHeight: "100dvh", padding: 20, color: color("text") }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <img src="/logo-mark.svg" alt="" style={{ height: 28 }} />
        {chapter && <span style={{ color: accent, fontWeight: 600 }}>{chapter.title}</span>}
      </header>
      {children}
    </div>
  ),
  StartPage: ({ title }) => (
    <div style={{ textAlign: "center", paddingTop: 48 }}>
      <h1 style={{ fontFamily: display }}>{title}</h1>
      <p style={{ color: color("textMuted") }}>Questions appear here during the talk.</p>
    </div>
  ),
  ClosedPage: ({ title }) => <p>Thank you for joining “{title}”.</p>,
  IdlePage: () => <p style={{ color: color("textMuted") }}>No talk is running right now.</p>,
});
```
<!-- end snippet -->

## Tokens

The contract is a fixed list of token names; [tokens](tokens.md) lists every one with its CSS
variable. Core writes them as CSS variables onto stage and phone, and every template, block and
activity uses them instead of literal values. That is why a block written for one talk fits the
design of another.

The starter talk's colors, from `src/tokens.ts`:

<!-- snippet: packages/create/template/src/tokens.ts#colors -->
```ts
color: {
  background: "#fbf7f0",
  surface: "#f1e9dc",
  text: "#2b2118",
  textMuted: "#7a6a5a",
  primary: "#c4532d",
  onPrimary: "#fbf7f0",
  border: "#dccfbd",
  positive: "#3f8f5b",
  negative: "#b93a3a",
  focus: "#e3a33b",
},
```
<!-- end snippet -->

- `base` is complete: every color, font and radius, and at least one chapter accent.
- `stage` and `phone` override colors for one surface. Fonts and radii are the same everywhere.
- `accents` are the chapter colors, assigned by chapter position and repeated when there are
  more chapters than accents. `--slidesend-accent` is always the current chapter's. The desk
  takes only the accents; it is not themeable beyond them.

In a component, read a token through its CSS variable:

```ts
import { accentVariable, cssVariable } from "@slidesend/core";

const text = `var(${cssVariable("color", "text")})`; // var(--slidesend-color-text)
const display = `var(${cssVariable("font", "display")})`;
const accent = `var(${accentVariable})`; // the current chapter's accent
```

To change only the colors of the default design and keep its frames and pages, spread it:

```ts
import { defaultDesign, defaultTokens } from "@slidesend/basics";
import { defineDesign } from "@slidesend/core";

export const myDesign = defineDesign({
  ...defaultDesign,
  name: "mine",
  tokens: {
    ...defaultTokens,
    base: { ...defaultTokens.base, accents: ["#d1495b", "#edae49", "#00798c"] },
  },
});
```

## Fonts

`fonts` lists font files for `@font-face`; put them in the project's `public/` folder:

```ts
const fonts = [
  { family: "My Display", src: "/brand/display.woff2", weight: 700 },
  { family: "My Sans", src: "/brand/sans.woff2", weight: "100 900" },
];
```

and name the families in the font tokens, with a fallback stack:
`display: "'My Display', Georgia, serif"`. If a file is missing, the fallback applies. Fonts
that may not be published belong in a private package or are fetched by a script before the
build, not in a public repository.

## Frames

- **`StageFrame`** wraps every slide on the 1920×1080 stage. It receives `progress` (step index,
  total, chapter index and title), `frame` (hints from the current step, e.g. `heroTitle` while
  a `section` shows its title centered, so the frame can show a large logo), and the slide as
  `children`. Logo positions and the progress bar live here.
- **`PhoneFrame`** wraps every phone page: header with logo and chapter (`chapter` is set while
  a session is open), footer line.

The logo is not a token: put the file in `public/` and place it in the frames.

## The three phone pages

| Page | When a phone shows it |
|---|---|
| `StartPage` | A session is open and no activity has started yet. Receives `title`, `subtitle`. |
| `ClosedPage` | For a while after the session closed (the session's `closedPageMinutes`). Receives `title`, `sessionName`. |
| `IdlePage` | There is no session at all. |

Their texts are the design's: the default design reads them from its UI strings, so a talk in
another language overrides them with `messages` ([writing-slides](writing-slides.md#ui-strings)).

## A design of your own as a package

A company design that several talks share is a package of its own, e.g. a private
`design-acme` in the talk repository: the palette and chapter accents as tokens, the font files,
a `StageFrame` with the logo positions of the company template, a `PhoneFrame`, and the script
that fetches font and logo files. It exports one `defineDesign(...)` result, and every talk
imports it into its `presentation.config.ts`.
