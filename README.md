# Slidesend

Slidesend is a presentation tool for talks in which the audience takes part on their phones. A deck
is written in TypeScript; the design, the hosting platform and every slide type come from plugins,
so a talk project brings its own content, colors, fonts and logo without forking the tool.

> Work in progress. Nothing is published yet.

## Packages

| Package | Contents |
|---|---|
| [`@slidesend/core`](packages/core) | deck schema, plugin, design and platform contracts, sessions, sync, the views |
| [`@slidesend/basics`](packages/basics) | the `section` template, generic blocks, simple activities, the default design |
| [`@slidesend/aws`](packages/aws) | platform implementation and hosting on AWS Blocks, bootstrap and deploy |
| [`@slidesend/agent`](packages/agent) | the agent chat activity |

Every package has a browser entry (`.`) and a server entry (`./server`); `@slidesend/core` also
has `./testing`. The browser entry never imports server code, and a test enforces that.

[`examples/gravity`](examples/gravity) is the example talk "How does gravity work?". It consumes
the packages like any other talk project would.

## Development

Requires the Node version in [`.nvmrc`](.nvmrc) and pnpm (the version is pinned in
`package.json`).

```sh
pnpm install
pnpm --filter gravity exec playwright install chromium   # once, for the browser checks
pnpm check                                               # build, types, lint, unit and browser tests
pnpm --filter gravity dev                                # run the example talk
```

`pnpm check` is exactly what CI runs on every pull request. Record user-facing package changes
with `pnpm changeset`.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Carsten Koch.
