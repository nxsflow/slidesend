# @slidesend/core

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
