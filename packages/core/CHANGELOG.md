# @slidesend/core

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
