# @slidesend/aws

## 0.3.2

### Patch Changes

- f731af2: `slidesend bootstrap` imports the account's existing GitHub OIDC provider instead of creating a second one, so a second talk in the same AWS account can deploy. A provider that the talk's own bootstrap stack created stays in that stack.
- @slidesend/core@0.3.2

## 0.3.1

### Patch Changes

- aedfe1b: On AWS, a page that wakes up (visible again, back online, shown from the back-forward cache) opens every live subscription afresh and then reads what it missed. A connection that died silently while a phone was locked no longer leaves the phone deaf to answers and agent replies until the next reconnect. Two wake signals at once open each subscription only once.
- Updated dependencies [aedfe1b]
  - @slidesend/core@0.3.1

## 0.3.0

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
- 1babc9e: The workflow `slidesend workflow` writes uses pnpm/action-setup 6.1.0.
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

- 1babc9e: The workflow `slidesend workflow` writes uses pnpm/action-setup 6.1.0.
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
