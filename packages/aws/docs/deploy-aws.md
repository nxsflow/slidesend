# Deploy to AWS

`@slidesend/aws` puts a talk online on AWS: the site on Amazon CloudFront, the backend on
AWS Blocks (AWS Lambda, Amazon DynamoDB, WebSockets through Amazon API Gateway), the control
secret in AWS Systems Manager Parameter Store. This page takes a talk that runs locally
([getting-started](../../core/docs/getting-started.md)) to its first deployment from your
machine. [continuous-deployment](continuous-deployment.md) then deploys it from GitHub Actions.

## What you need

- **An AWS account** you may deploy to, ideally one only for talks: `slidesend destroy` removes
  the talk's stack, but an account of its own keeps the bill and the permissions easy to read.
  In an AWS Organization, a sandbox organizational unit is the right place.
- **Local access** through the AWS CLI v2, with a named profile. With IAM Identity Center
  (SSO):

  ```sh
  aws configure sso --profile my-talk     # once: start URL, account, role, region
  aws sso login --profile my-talk         # whenever the session has expired
  aws sts get-caller-identity --profile my-talk
  ```

  With access keys, `aws configure --profile my-talk` instead. The role needs to create
  CloudFormation stacks with IAM roles, so in practice an administrator role in that account.
  Every `slidesend` command takes `--profile my-talk`; `export AWS_PROFILE=my-talk` saves typing.
- **A region**, set in the talk's config: `platform: aws({ region: "eu-central-1" })`. Any
  region with Amazon Bedrock works if the talk has an agent. `--region` on a command overrides
  it once.
- **The account bootstrapped for the AWS CDK**, once per account and region:

  ```sh
  npx cdk bootstrap aws://<account-id>/eu-central-1 --profile my-talk
  ```

## What it costs

Estimated from the resources the stack creates (prices of eu-central-1; check your own bill):

- **Idle**, between talks: about USD 1 per month, mostly one AWS KMS key and one Amazon
  CloudWatch alarm. Everything else is billed per request or per stored byte, and a talk stores
  little.
- **During a session**: Lambda calls, DynamoDB writes and WebSocket messages for every phone,
  including one presence heartbeat per device every 20 seconds. For a class-sized audience that
  is a few cents per session.
- **An agent** costs per question on top: about USD 0.0005 per question on the `fast` tier
  ([agents](../../agent/docs/agents.md#models-and-cost)).

Nothing that costs money runs outside an open session, and a forgotten session closes on its own.

## Prepare the talk project

### Packages

```sh
pnpm add @slidesend/aws @aws-blocks/blocks@0.6.0 @aws-blocks/bb-realtime aws-blocks@link:./aws-blocks
pnpm add -D aws-cdk@~2.1143.0 tsx esbuild
```

With an agent, also `pnpm add @slidesend/agent @aws-blocks/bb-file-bucket`. `esbuild` must be a
dependency of the repository's root package; in a monorepo, add it there (`pnpm add -Dw esbuild`).

### The platform

```ts fragment
// presentation.config.ts
import { aws } from "@slidesend/aws";

export default definePresentation({
  deck,
  design: defaultDesign,
  platform: aws({ region: "eu-central-1" }),
  plugins: [basics()],
});
```

### The backend

AWS Blocks needs the talk project to own its backend file, and it takes the name of each
exported variable as an API namespace. `aws-blocks/index.ts`:

```ts fragment
import { Scope } from "@aws-blocks/blocks";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";

const backend = createAwsBackend(new Scope("my-talk"), config);
export const slidesend = backend.api;
```

Export only API namespaces, never `backend` itself: every exported object becomes a publicly
callable namespace. The example talk's backend, with the agent chat next to core:

<!-- snippet: examples/gravity/aws-blocks/index.ts#aws-backend -->
```ts
const scope = new Scope("gravity");
const backend = createAwsBackend(scope, config);
export const slidesend = backend.api;

// The agent chat's own namespace: one Agent block per defined agent, wired by explicit
// composition rather than discovered (spec §4.1, D4).
export const agentChat = createAgentChat(scope, {
  agents,
  platform: backend.platform,
  guards: backend.server.sessions.guards,
  tools: { newton: newtonTools },
}).api;
```
<!-- end snippet -->

`aws-blocks/index.handler.ts` is the Lambda entry that loads it:

```ts fragment
import { createLambdaHandler } from "@aws-blocks/blocks/lambda-handler";

export const handler = createLambdaHandler(() => import("./index.js"));
```

`aws-blocks/package.json` makes the folder importable as `aws-blocks`: the browser gets the
client that AWS Blocks generates (`client.js`), Node gets the backend:

```json
{
  "name": "aws-blocks",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./index.ts",
      "browser": "./client.js",
      "import": "./client.js",
      "default": "./index.ts"
    }
  }
}
```

`.blocks/config.json` names the stack, and belongs in the repository:

```json
{ "stackId": "sd-my-talk" }
```

Keep the stack id short: bucket names are built from it and stop at 63 characters, and
`slidesend bootstrap` checks that. The deployed stack is called `<stackId>-prod`.

Add to `.gitignore`: `.bb-data/`, `.blocks-sandbox/`, `aws-blocks/client.js`, `dist`,
`cdk.out`, `.hosting/`.

### The site

`package.json` builds the site with the generated client:

```json
"scripts": {
  "build": "blocks-generate-client && vite build"
}
```

`src/main.ts` hands the AWS client to `mount` when the page runs on AWS, and stays in local mode
otherwise. `slidesend dev` and `slidesend deploy` set `VITE_SLIDESEND_PLATFORM=aws`:

```ts fragment
import { mount, type PlatformClient } from "@slidesend/core";
import presentation from "../presentation.config";

async function platform(): Promise<PlatformClient | undefined> {
  if (import.meta.env.VITE_SLIDESEND_PLATFORM !== "aws") return undefined;
  const [{ awsClient }, blocks] = await Promise.all([
    import("@slidesend/aws"),
    import("aws-blocks"),
  ]);
  // Every namespace the backend exports: core's `slidesend` and, with an agent, `agentChat`.
  return awsClient(blocks as unknown as { slidesend: unknown });
}

mount(presentation, { platform: await platform() });
```

A run without AWS (plain `vite`, `slidesend check --render`) has no generated `client.js`, so
point `aws-blocks` at an empty module there. `vite.config.ts`:

```ts file=vite.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve:
    process.env.VITE_SLIDESEND_PLATFORM === "aws"
      ? {}
      : { alias: { "aws-blocks": fileURLToPath(new URL("./src/no-blocks.ts", import.meta.url)) } },
});
```

with `src/no-blocks.ts` containing `export const slidesend = undefined;`.

### Try it on the dev server

```sh
pnpm exec slidesend dev
```

runs the backend on the AWS Blocks dev server with local mocks, no AWS account involved, and
prints a desk link with a local control secret. Everything from
[sessions-and-desk](../../core/docs/sessions-and-desk.md) works here, phones included.

## The first deployment

1. Sign in: `aws sso login --profile my-talk`.
2. Check the preconditions: `pnpm exec slidesend bootstrap --profile my-talk`. It changes
   nothing and lists what is missing, each with the command that fixes it. For a deployment from
   your machine the AWS checks matter (profile, region, CDK bootstrap, `esbuild`, stack id,
   bucket names); the GitHub checks belong to
   [continuous-deployment](continuous-deployment.md).
3. Deploy: `pnpm exec slidesend deploy --profile my-talk`. It builds the site, synthesizes the
   stack `<stackId>-prod` and deploys it. The first deployment takes about 10 to 12 minutes,
   most of it Amazon CloudFront.
4. At the end it prints:

   ```text
     Desk   https://d1234abcd.cloudfront.net/desk#key=…
     Phones https://d1234abcd.cloudfront.net/
     The desk link carries the control secret: share it only with whoever runs the talk.
   ```

5. Open the desk link. Prepare should say that this device holds control. Create a rehearsal,
   open it, open the stage, and join with a phone.

`slidesend open --profile my-talk` prints the desk link again at any time.

### A custom domain

`aws({ region, domain: "talk.example.com" })` serves the talk under your domain. The hosted
zone comes from the bootstrap stack (`slidesend bootstrap --deploy`, see
[continuous-deployment](continuous-deployment.md#3-bootstrap)), which prints its name servers.
Delegate the domain to them before the first `slidesend deploy`: the certificate is validated
over DNS.

## Runtimes

Everything runs on Node.js 24: your machine and CI (`.nvmrc`, `engines`), and every Lambda of
the stack. `@slidesend/aws` moves each Node.js function to `nodejs24.x`, whatever runtime AWS
Blocks or the CDK would pick, and names every exception in a warning when the stack is
synthesized. There are two, both from libraries:

| What | Runtime | Why |
|---|---|---|
| The two functions that copy the site to S3 (`Custom::CDKBucketDeployment`) | Python 3.13 | The CDK's `BucketDeployment` is written in Python and has no Node.js variant. They run only during a deploy. |
| The agent's AgentCore runtime (with `@slidesend/agent`) | Node.js 22 | AgentCore offers no Node.js 24 runtime yet. |

## Updating and removing

Run `slidesend deploy` again after every change; only what changed is updated. Answers and
sessions survive an update.

`slidesend destroy --profile my-talk` removes the talk's stack with all its data (sessions,
answers, conversations) in about four minutes. It says what stays: the bootstrap stack and its
deploy role, the CDK bootstrap, a hosted zone, and the Lambda log groups. A later
`slidesend deploy` builds everything afresh, with a new control secret and, without a custom
domain, a new address.

## When something goes wrong

| Symptom | Cause and fix |
|---|---|
| `No AWS identity for profile …` | The SSO session expired: `aws sso login --profile …`. |
| `Has the environment been bootstrapped?` | Run the `cdk bootstrap` command above for this account and region. |
| `The talk cannot be deployed yet. Missing: …` | Install what it names; see [Packages](#packages). |
| The deploy fails on a bucket name | Shorten `stackId` in `.blocks/config.json`. |
| `AccessDenied … with an explicit deny in a service control policy` | An organization policy forbids the action or the region. Look up the event in AWS CloudTrail; it names the policy. For Bedrock, see [agents](../../agent/docs/agents.md#models-and-cost). |
| The desk says view only | The link was opened without its `#key=…` part; use `slidesend open`. |
