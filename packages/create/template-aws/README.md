# Your first Slidesend talk, on AWS

A talk that explains how it is made, ready to deploy to AWS. Start it, then read `src/deck.ts`
next to it.

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

The documentation ships with the packages: `node_modules/@slidesend/core/docs/README.md`.
