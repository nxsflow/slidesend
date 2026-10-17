# Your first slidesend talk, on AWS

A talk that explains how it is made, ready to deploy to AWS. Start it, then read `src/deck.ts`
next to it.

slidesend is made to be written with an AI coding agent: open this folder in yours and tell it
what your talk is about. `AGENTS.md` points it to the documentation in `node_modules`, starting
with `building-a-talk.md`.

```sh
npm run dev        # the AWS Blocks dev server with local mocks; prints the desk link
npm run check      # validates the deck
```

Open the desk link that `npm run dev` prints (with `#key=…`), and open the stage from the desk
(**Rehearse**, then **Open the stage**). No AWS account is needed for this.

To put the talk online, follow `node_modules/@slidesend/aws/docs/deploy-aws.md`: sign
in with an AWS profile, then `npm run deploy -- --profile <name>`. `npm run destroy` removes it
again. The region is set in `presentation.config.ts`, the stack name in `.blocks/config.json`.

`npm run check:render` and `npm run pdf` use a browser: run `npx playwright install chromium`
once before.

`aws-blocks/index.ts` is the talk's backend. Export only API namespaces from it (`slidesend`,
and `agentChat` with an agent): never the Scope, building blocks, the backend object, helpers or
configuration, and no `export *`. AWS Blocks serves every export to anyone, so the Lambda entry
`aws-blocks/index.handler.ts` refuses to start, and `npm run dev` and `npm run deploy` stop,
when it exports anything else.

The documentation ships with the packages: `node_modules/@slidesend/core/docs/README.md`.
