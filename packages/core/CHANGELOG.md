# @slidesend/core

## 0.3.3

No changes in this release.

## 0.3.2

No changes in this release.

## 0.3.1

### Patch Changes

- aedfe1b: On AWS, a page that wakes up (visible again, back online, shown from the back-forward cache) opens every live subscription afresh and then reads what it missed. A connection that died silently while a phone was locked no longer leaves the phone deaf to answers and agent replies until the next reconnect. Two wake signals at once open each subscription only once.

## 0.3.0

### Patch Changes

- 05156ee: The desk's Present header groups what it shows under labels: Now (step and elapsed time), Against the plan (ahead or behind, in words and colour, and where the plan is at this step) and Session (kind, stages and phones, when it closes, +10 min).
- f4c3b08: `pollMatrix`, `pollList` and `textList` take `qr: true`: a small join QR code beside the results, so latecomers can still join while the answers come in. It shows the running session's own address (a rehearsal's private link included) and nothing in local mode or in print. The plugins guide shows how a block of your own reads the join address (`useSessionInfo`, `joinUrl`).

## 0.2.2

### Patch Changes

- a63cbc4: Getting started says how to look at the slides without a backend (`npm run local`, `/stage/local?slide=…`), why `vite --mode local` fails, and that browser scripts import from `@playwright/test`.

## 0.2.1

### Patch Changes

- abed97f: A talk created with pnpm installs again under pnpm 12: the starter writes a `pnpm-workspace.yaml` that allows esbuild's install script. pnpm 12 failed the install over the ignored script (`ERR_PNPM_IGNORED_BUILDS`).

## 0.2.0

No changes in this release.

## 0.1.3

### Patch Changes

- a007977: A desk or stage that steers is no longer pulled back a step when a read of the cursor lands while its own move is still on its way. The read returned the cursor before the move, and the window followed it.

## 0.1.2

### Patch Changes

- 2d76422: The dev bridge serves all subscriptions of a page over one event stream. With a stream per subscription, desk, stage and phone in one browser used up the browser's six connections per host a few steps into the talk: the stage stopped following the desk, phones missed the current poll, and the desk counted no stage.
- 00a9adb: Editing a talk no longer throws the desk out of a rehearsal. The dev bridge keeps its control secret and its sessions when Vite restarts its server (after a change to `vite.config.ts`), and a reloaded desk comes back to the session it presented, at its current step.

## 0.1.1

### Patch Changes

- d541233: Docs brought in step with the code after the desk redesign: local mode, the dev bridge's desk links, the Present and Review controls, the AWS commands and their options, the bootstrap and workflow details, and the agent fields. The starter's dev server plans 20 minutes, like its deck, and its AGENTS.md names the optional packages as optional. Package keywords and author added.

## 0.1.0

### Minor Changes

- 26b3616: A guide for the coding agent that builds a talk: the decisions to ask the speaker for, setting up the talk, structuring the content, applying a design and adding templates. The starter's AGENTS.md starts there.
- 0fe96c7: The desk is one flow for first-time speakers: a start page with **Rehearse** and **Go live** (one click creates and opens a session), a dark speaker view with the notes in large type next to the stage, the next step, the clock and a fixed control bar, and the review after **End session**. Desk previews now show the session's own join code and live results. The starter talk shows that Slidesend is made for AI coding agents, with speaker notes on every step, and `npm create` says how to work on it with an agent.
- 234d7ad: The first release of Slidesend: decks in TypeScript with plugins and designs, sessions with phones, the desk, AWS hosting with continuous deployment, the agent chat, and `npm create @slidesend`.

### Patch Changes

- 511d09b: Node.js 24 everywhere: the packages require Node.js 24 (`engines`), every Lambda of a deployed talk runs on `nodejs24.x` whatever runtime a library picks (the two library exceptions are named in a synth warning), the workflow `slidesend workflow` writes pins every action to a commit of a release that runs on Node.js 24, and the starter talk ships an `.nvmrc`.
- 283b3a6: Published through npm trusted publishing: no npm token is involved in releasing anymore, and every version carries its provenance.

## 0.1.0-alpha.4

### Minor Changes

- 0fe96c7: The desk is one flow for first-time speakers: a start page with **Rehearse** and **Go live** (one click creates and opens a session), a dark speaker view with the notes in large type next to the stage, the next step, the clock and a fixed control bar, and the review after **End session**. Desk previews now show the session's own join code and live results. The starter talk shows that Slidesend is made for AI coding agents, with speaker notes on every step, and `npm create` says how to work on it with an agent.

## 0.1.0-alpha.3

No changes in this release.

## 0.1.0-alpha.2

### Patch Changes

- 511d09b: Node.js 24 everywhere: the packages require Node.js 24 (`engines`), every Lambda of a deployed talk runs on `nodejs24.x` whatever runtime a library picks (the two library exceptions are named in a synth warning), the workflow `slidesend workflow` writes pins every action to a commit of a release that runs on Node.js 24, and the starter talk ships an `.nvmrc`.

## 0.1.0-alpha.1

### Patch Changes

- 283b3a6: Published through npm trusted publishing: no npm token is involved in releasing anymore, and every version carries its provenance.

## 0.1.0-alpha.0

### Minor Changes

- 234d7ad: The first release of Slidesend: decks in TypeScript with plugins and designs, sessions with phones, the desk, AWS hosting with continuous deployment, the agent chat, and `npm create @slidesend`.
