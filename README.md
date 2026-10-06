# slidesend

slidesend is a presentation tool for talks in which the audience takes part on their phones. A
deck is written in TypeScript; the design, the hosting platform and every slide type come from
plugins, so a talk project brings its own content, colors, fonts and logo without forking the
tool.

The sections below follow the same outline as the documentation that ships inside the packages,
which is written for the coding agents that help you build a talk. Each section links to its
full version.

## Getting started

```sh
npm create @slidesend@latest my-talk
cd my-talk
npm run dev
```

creates a talk, installs it and starts it, with phones from your network and no cloud account.
The talk explains how it is made: its own design, its own plugin, the blocks of the basics and
questions for the phones. With `npm create @slidesend@latest my-talk -- --aws` it is ready to deploy. → [getting-started](packages/core/docs/getting-started.md)

## Building a talk with an agent

slidesend is made to be written with an AI coding agent. Every talk has an `AGENTS.md` that
points the agent at the docs of the installed version, and the agent works through them in
order: it asks the speaker for the decisions only they can make (message, audience, length,
language, storyline, participation, design, hosting), turns the starter into the talk, writes
one idea per slide with the spoken words as notes, applies the design through tokens, and adds a
template of the talk's own only where the basics cannot show the content. `slidesend check`
names every mistake by slide and field, so the agent can fix it.
→ [building-a-talk](packages/core/docs/building-a-talk.md)

## Writing slides

Everything in a deck is a node, `{ type, ...data }`: slides own the stage, blocks fill a
slide's slots, activities run on the phones. Each click is a step with its own notes, cue,
planned minutes and print rule. There are no clock times in a deck; the planned length is the
sum of the steps. `@slidesend/basics` brings a carousel-like `section`, text blocks, polls with
live results, free-text questions and more. → [writing-slides](packages/core/docs/writing-slides.md)

## Plugins

When the basics are not enough, write a node of your own: one function per node, a Zod schema,
a React component. The example talk draws the Moon's orbit in three clicks with a block of its
own. A plugin bundles nodes with their UI strings. → [plugins](packages/core/docs/plugins.md)

## Design

A design is a fixed list of tokens (colors, fonts, radii and one accent color per chapter) plus
the frames around stage and phone and the three pages a phone shows before, after and between
talks. Templates use only tokens, so every node fits every design. → [design](packages/core/docs/design.md)

## Agents

The audience can ask an AI agent on their phones: a chat with history that survives a locked
phone, running on Amazon Bedrock when deployed and on a canned provider locally. It only answers
while a session is open, with a cap on turns and message length per phone; a question costs
about USD 0.0005 on the fast tier. → [agents](packages/agent/docs/agents.md)

## Sessions and the desk

A session is one run of the talk, a rehearsal or the real thing, each with its own answers and
timings. The desk starts one in a click (rehearse or go live), presents it in a dark speaker view
with the notes in large type next to the stage, the next step and the clock, and reviews it
afterwards (planned against measured time per step, adopt as plan, export, delete). → [sessions-and-desk](packages/core/docs/sessions-and-desk.md)

## Deploy to AWS

`@slidesend/aws` deploys a talk with one command: `slidesend deploy` builds the site, deploys it
with AWS Blocks and prints the desk link with the control secret. You need an AWS account, a
signed-in AWS CLI profile, a region, and the account bootstrapped once for the AWS CDK. Between
talks it costs about USD 1 a month; `slidesend destroy` removes it. → [deploy-aws](packages/aws/docs/deploy-aws.md)

## Continuous deployment

`slidesend bootstrap` checks every precondition and creates a deploy role that only this
repository's `production` environment can assume, through OIDC and without access keys.
`slidesend workflow` writes the GitHub Actions workflow. When role assumption is denied,
CloudTrail tells a wrong trust policy from an organization policy.
→ [continuous-deployment](packages/aws/docs/continuous-deployment.md)

## Hosting adapters

AWS is the only platform today. Core's server logic is written against a small contract
(storage, push channels, secrets, a clock) with an in-memory reference implementation, so
another platform is a package of its own. → [hosting-adapters](packages/core/docs/hosting-adapters.md)

## Packages

| Package | Contents |
|---|---|
| [`@slidesend/core`](packages/core) | deck schema, plugin, design and platform contracts, sessions, sync, the views, the `slidesend` command |
| [`@slidesend/basics`](packages/basics) | the `section` template, generic blocks, simple activities, the default design |
| [`@slidesend/aws`](packages/aws) | platform implementation and hosting on AWS Blocks, bootstrap, deploy, workflow |
| [`@slidesend/agent`](packages/agent) | the agent chat activity |
| [`@slidesend/create`](packages/create) | `npm create @slidesend`: the starter talk, local or `--aws` |

Every library package has a browser entry (`.`) and a server entry (`./server`);
`@slidesend/core` also has `./testing` and `./checks`, `@slidesend/aws` also `./commands` and
`./infra`. The browser entry never imports server code, and a test enforces that.
`@slidesend/create` is only a command.

[`examples/gravity`](examples/gravity) is the example talk "How does gravity work?". It consumes
the packages like any other talk project would. The code samples in the docs are cut from it and
from the starter talk in [`packages/create/template`](packages/create/template).

## Development

Requires the Node version in [`.nvmrc`](.nvmrc) and pnpm (the version is pinned in
`package.json`).

```sh
pnpm install
pnpm --filter gravity exec playwright install chromium   # once, for the browser checks
pnpm check                                               # build, types, lint, tests, deck, browser, starter
pnpm --filter gravity dev                                # run the example talk
```

To try the starter with packages that are not released yet, pack them and point
`create-slidesend` at the packs; the new talk then installs them by absolute path:

```sh
pnpm build
for p in core basics aws agent create; do (cd packages/$p && pnpm pack --pack-destination /tmp/packs); done
SLIDESEND_CREATE_TARBALLS=/tmp/packs npx --yes --package /tmp/packs/slidesend-create-*.tgz create-slidesend my-talk
```

CI runs `pnpm check` on every pull request, plus the PDFs of the example talk and the changeset
check. Code samples in the docs are copied from the example talk or the starter talk between `// snippet: <name>` and `// end snippet`; after changing one, run
`UPDATE_DOCS=1 pnpm test` to copy it again. [docs/docs-tests.md](docs/docs-tests.md) explains
every docs check and how to fix it.

Every change to a package needs a changeset (`pnpm changeset`, or `pnpm changeset --empty` when
users will not notice it). Merging one with a version bump into `main` releases all packages to
npm, as a stable version, or as alpha or beta in pre mode. [docs/releasing.md](docs/releasing.md) explains the release workflow.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Carsten Koch.
