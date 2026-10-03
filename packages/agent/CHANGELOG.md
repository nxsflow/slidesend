# @slidesend/agent

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
