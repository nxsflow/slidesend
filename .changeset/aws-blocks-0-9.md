---
"@slidesend/aws": minor
"@slidesend/agent": minor
"@slidesend/create": minor
---

AWS Blocks 0.9.0: `@slidesend/aws` and `@slidesend/agent` now need `@aws-blocks/blocks` `^0.9.0` (was `^0.8.0`), and new talks get `@aws-blocks/blocks@0.9.0` and `@aws-blocks/bb-realtime@^0.5.0`. Upgrade an existing talk with `@aws-blocks/blocks@0.9.0`, `@aws-blocks/bb-realtime@^0.5.0` and, with an agent, `@aws-blocks/bb-file-bucket@^0.4.0`.

- A custom domain is passed to AWS Blocks' `Hosting` as a feature of its front door (`frontDoor.features.domain`), which replaces the top-level `domain` that AWS Blocks 0.9.0 deprecated. The synthesized stack is the same, so a deployed talk is not changed.
- The runtime every Node.js Lambda gets is AWS Blocks' own `DEFAULT_NODE_RUNTIME` (Node.js 24) instead of a copy of it, so the talk's functions and AWS Blocks' never disagree.
