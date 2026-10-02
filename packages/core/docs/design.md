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

This is the example talk's design:

<!-- snippet: examples/gravity/src/design.tsx#define-design -->
```tsx
export const gravityDesign = defineDesign({
  name: "gravity",
  tokens: {
    base: {
      color: {
        background: "#0b1020",
        surface: "#151c33",
        text: "#eef1f8",
        textMuted: "#9aa3b8",
        primary: "#7aa2ff",
        onPrimary: "#0b1020",
        border: "#2a3350",
        positive: "#5fd39a",
        negative: "#ff7a7a",
        focus: "#ffd166",
      },
      font: {
        display: "Georgia, 'Times New Roman', serif",
        sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        mono: "ui-monospace, 'SF Mono', Menlo, monospace",
      },
      radius: { small: "6px", large: "18px" },
      accents: ["#7aa2ff", "#ffd166", "#5fd39a"],
    },
    phone: { color: { background: "#10162b" } },
  },
  StageFrame: ({ progress, children }) => (
    <>
      {children}
      <div
        data-progress
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 8,
          width: `${((progress.index + 1) / progress.total) * 100}%`,
          background: accent,
          transition: "width 400ms ease-out",
        }}
      />
    </>
  ),
  PhoneFrame: ({ chapter, children }) => (
    <div style={{ minHeight: "100dvh", padding: 20, color: token.text }}>
      {chapter && (
        <header style={{ color: accent, fontWeight: 600, marginBottom: 16 }}>
          {chapter.title}
        </header>
      )}
      {children}
    </div>
  ),
  StartPage: ({ title, subtitle }) => (
    <div data-page="start">
      <h1 style={{ fontFamily: token.display }}>{title}</h1>
      {subtitle && <p style={{ color: token.muted }}>{subtitle}</p>}
      <p style={{ color: token.muted }}>Questions appear here.</p>
    </div>
  ),
  ClosedPage: ({ title }) => <p data-page="closed">Thanks for joining “{title}”.</p>,
  IdlePage: () => <p data-page="idle">Nothing is happening right now.</p>,
});
```
<!-- end snippet -->

## Tokens

The contract is a fixed list of token names; [tokens](tokens.md) lists every one with its CSS
variable. Core writes them as CSS variables onto stage and phone, and every template, block and
activity uses them instead of literal values. That is why a block written for one talk fits the
design of another.

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
