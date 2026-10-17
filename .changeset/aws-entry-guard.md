---
"@slidesend/aws": minor
"@slidesend/agent": minor
"@slidesend/create": minor
---

Security hardening of the AWS backend. AWS Blocks answers `POST /aws-blocks/api` for any export of a talk's `aws-blocks/index.ts` without authentication, so an exported Scope, building block, helper or the whole `createAwsBackend` result would be callable by anyone.

- `@slidesend/aws/server` exports `onlyApiNamespaces(entry)`, which throws naming every export of the backend entry module that is not an API namespace. The Lambda entry runs the module through it: `createLambdaHandler(() => import("./index.js").then(onlyApiNamespaces))`. `slidesend dev` and `slidesend deploy` stop on the same mistake before anything ships.
- New talks (`npm create @slidesend -- --aws`) get the guarded Lambda entry. An existing talk should change its `aws-blocks/index.handler.ts` to the line above.
- AWS Blocks 0.8.0: `@slidesend/aws` and `@slidesend/agent` now need `@aws-blocks/blocks` `^0.8.0` (was `^0.6.0`), whose dispatcher already refuses exported building blocks. Upgrade the talk with `@aws-blocks/blocks@0.8.0`, `@aws-blocks/bb-realtime@^0.4.0` and, with an agent, `@aws-blocks/bb-file-bucket@^0.3.1`. The deploy now passes the talk's public variables with `registerConfig`, since AWS Blocks 0.8.0 removed `BlocksStack.handler`.
