# The docs tests

The product docs (`README.md` and `packages/*/docs`) are tested in `pnpm check`, so that they
cannot drift from the code (spec §15). This page says what each check guards and how to fix a
failure. All of them live in `tests/`; `tests/docs-checks.test.ts` proves on the fixtures in
`tests/fixtures/docs` that each one fails when it should.

## 1. Embedded snippets (`doc-snippets.test.ts`)

Code samples from the example talk are copied into the docs, never written by hand. A source
file marks a region:

```ts fragment
// snippet: define-block
export const orbit = defineBlock({ ... });
// end snippet
```

and a document embeds it:

```markdown
<!-- snippet: examples/gravity/src/plugin.tsx#define-block -->
<!-- end snippet -->
```

Everything between those two lines is generated.

**Failure: "are current in …"**: the source changed, or someone edited the copy. Run
`UPDATE_DOCS=1 pnpm test` and commit the result. Never edit an embedded copy; change the source
in `examples/gravity` (where it is type-checked and tested) instead. "has no snippet" means the
marker was renamed or removed in the source.

## 2. Free-standing samples (`doc-samples.test.ts`)

Every `ts` and `tsx` sample that is not embedded is compiled against the built packages, inside
the example talk's `node_modules`. The fence's info string says how:

| Fence | Compiled as |
|---|---|
| ```` ```ts ```` | a module of its own |
| ```` ```ts file=src/main.ts ```` | that file of a talk project; later samples of the same document see it, so a `main.ts` can import the config shown above it |
| ```` ```ts fragment ```` | not at all: a piece of a larger file, such as one field of a config |

**Failure: `<document>:<line>: TS…`**: the sample at that line no longer compiles. Usually an
API changed: fix the sample, and read the prose around it, which is probably wrong too. If the
sample needs a file shown earlier, give both a `file=`. Mark a sample `fragment` only where the
surrounding code would hide what it shows; a fragment is no longer checked. The packages must be
built first (`pnpm build`), as `pnpm check` does.

## 3. Generated references (`reference-docs.test.ts`, `token-docs`, `message-docs`, `cli`)

These files are generated from the code and must not be edited by hand:

| File | Generated from |
|---|---|
| `packages/slidesend-core/docs/commands.md` | core's command definitions |
| `packages/slidesend-core/docs/tokens.md` | the design token list |
| `packages/slidesend-core/docs/messages.md` | the UI strings of every package |
| `packages/slidesend-basics/docs/nodes.md`, `packages/slidesend-agent/docs/nodes.md` | each node's Zod schema (`nodeReferenceTable`) |
| `packages/slidesend-aws/docs/commands.md` | the commands of `aws()` |

**Failure: "keeps … in step"**: the code changed. Run `UPDATE_DOCS=1 pnpm test`, read the diff
(it is the change users will see), and commit it. If a slot or reference shows up as `unknown`,
give its schema a `.describe("…")`.

## 4. Links (`docs-checks.test.ts`, "links in the docs")

Every relative link in the docs must lead to an existing file, and an anchor to an existing
heading (GitHub's form: lowercase, punctuation dropped, spaces as dashes). Links to other sites
are not checked.

**Failure: "lead somewhere in …"** lists each broken link with "no such file" or "no such
heading". Fix the link, or the heading it points to; when you rename a heading, search the docs
for its old anchor. Links between packages are written as `../../<package>/docs/<file>.md`,
which works in the repository and in `node_modules` alike.

## 5. The starter talk (`pnpm check:starter`)

`scripts/starter-check.mjs` does what a new user does: it packs the packages, runs the create
command from its own tarball, and checks the talk it writes — the local variant installed with
npm, the AWS variant with pnpm — with `typecheck`, `check:render` and `build`. The starter's code
samples in getting-started, design and plugins are embedded from `packages/create-slidesend/template`.

**Failure**: the log ends with "The starter check failed; the files are in <folder>". The talk
it wrote is still there: `cd` into it and rerun the failing command. A type error or an
overflowing step is fixed in `packages/create-slidesend/template` (a workspace package, so
`pnpm --filter slidesend-starter …` runs its scripts in place); a missing file in the new talk
usually means `files` in `packages/create-slidesend/package.json` leaves it out.

