# @slidesend/create

```sh
npm create @slidesend@latest my-talk
```

Creates `./my-talk` with a slidesend talk that explains how it is made — its own design, its own
plugin, the blocks of the basics and questions for the phones — installs it, and prints how to
start it. With npm, options go after `--`: `npm create @slidesend@latest my-talk -- --aws` makes
the variant that deploys to AWS; `--yes` (`-y`), `--no-install` and `--package-manager <pm>`
(`--pm`) make it usable from scripts; `--help` lists them.

The talk is made to be written with an AI coding agent: its `AGENTS.md` points the agent at the
docs in `node_modules`, starting with `@slidesend/core/docs/building-a-talk.md`.

slidesend is a presentation tool for talks in which the audience takes part on their phones:
https://github.com/nxsflow/slidesend
