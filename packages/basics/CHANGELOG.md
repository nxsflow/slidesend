# @slidesend/basics

## 0.3.3

### Patch Changes

- @slidesend/core@0.3.3

## 0.3.2

### Patch Changes

- @slidesend/core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [aedfe1b]
  - @slidesend/core@0.3.1

## 0.3.0

### Minor Changes

- f4c3b08: `pollMatrix`, `pollList` and `textList` take `qr: true`: a small join QR code beside the results, so latecomers can still join while the answers come in. It shows the running session's own address (a rehearsal's private link included) and nothing in local mode or in print. The plugins guide shows how a block of your own reads the join address (`useSessionInfo`, `joinUrl`).

### Patch Changes

- Updated dependencies [05156ee]
- Updated dependencies [f4c3b08]
  - @slidesend/core@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [a63cbc4]
  - @slidesend/core@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [abed97f]
  - @slidesend/core@0.2.1

## 0.2.0

### Minor Changes

- f659da8: `pollMatrix` is easier to read on stage: a centered grid with large cells, each axis captioned (the first question beside the rows, the second above the columns, by their `short`), and cells shaded relative to the fullest one. `axes: { x, y }` overrides the captions.
- b4fb76c: `section` takes an optional `eyebrow`: a short line above the title, e.g. the event or the series, in mono type and the chapter's accent. It sits in the title's own block, so it travels with a hero title and fits titles of any length.

### Patch Changes

- @slidesend/core@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [a007977]
  - @slidesend/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [2d76422]
- Updated dependencies [00a9adb]
  - @slidesend/core@0.1.2

## 0.1.1

### Patch Changes

- d541233: Docs brought in step with the code after the desk redesign: local mode, the dev bridge's desk links, the Present and Review controls, the AWS commands and their options, the bootstrap and workflow details, and the agent fields. The starter's dev server plans 20 minutes, like its deck, and its AGENTS.md names the optional packages as optional. Package keywords and author added.
- Updated dependencies [d541233]
  - @slidesend/core@0.1.1

## 0.1.0

### Minor Changes

- 234d7ad: The first release of Slidesend: decks in TypeScript with plugins and designs, sessions with phones, the desk, AWS hosting with continuous deployment, the agent chat, and `npm create @slidesend`.

### Patch Changes

- 511d09b: Node.js 24 everywhere: the packages require Node.js 24 (`engines`), every Lambda of a deployed talk runs on `nodejs24.x` whatever runtime a library picks (the two library exceptions are named in a synth warning), the workflow `slidesend workflow` writes pins every action to a commit of a release that runs on Node.js 24, and the starter talk ships an `.nvmrc`.
- Updated dependencies [26b3616]
- Updated dependencies [0fe96c7]
- Updated dependencies [234d7ad]
- Updated dependencies [511d09b]
- Updated dependencies [283b3a6]
  - @slidesend/core@0.1.0

## 0.1.0-alpha.4

### Patch Changes

- Updated dependencies [0fe96c7]
  - @slidesend/core@0.1.0-alpha.4

## 0.1.0-alpha.3

### Patch Changes

- @slidesend/core@0.1.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- 511d09b: Node.js 24 everywhere: the packages require Node.js 24 (`engines`), every Lambda of a deployed talk runs on `nodejs24.x` whatever runtime a library picks (the two library exceptions are named in a synth warning), the workflow `slidesend workflow` writes pins every action to a commit of a release that runs on Node.js 24, and the starter talk ships an `.nvmrc`.
- Updated dependencies [511d09b]
  - @slidesend/core@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [283b3a6]
  - @slidesend/core@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- 234d7ad: The first release of Slidesend: decks in TypeScript with plugins and designs, sessions with phones, the desk, AWS hosting with continuous deployment, the agent chat, and `npm create @slidesend`.

### Patch Changes

- Updated dependencies [234d7ad]
  - @slidesend/core@0.1.0-alpha.0
