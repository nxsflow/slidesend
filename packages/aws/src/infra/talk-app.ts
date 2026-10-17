#!/usr/bin/env node
/**
 * The CDK app of a talk, so the talk project holds no CDK code of its own (spec §4, §14).
 * `slidesend deploy` and `slidesend destroy` run the CDK CLI against this file under the `cdk`
 * export condition and pass everything in one environment variable, `SLIDESEND_DEPLOY`.
 *
 * The talk project owns only what AWS Blocks insists on: `aws-blocks/index.ts` (the backend) and
 * `aws-blocks/index.handler.ts` (the Lambda entry that loads it).
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BlocksPresets, BlocksStack, Hosting, registerConfig } from "@aws-blocks/blocks/cdk";
import { App, Aspects, RemovalPolicy } from "aws-cdk-lib";
import { onlyApiNamespaces } from "../server/entry-guard";
import { NodeRuntimePolicy } from "./runtime-policy";
import { publicVariables, talkInput } from "./talk-input";

const input = talkInput(process.env.SLIDESEND_DEPLOY);
const backend = join(input.projectRoot, "aws-blocks");
const app = new App();

const stack = await BlocksStack.create(app, input.stackName, {
  backendHandlerPath: join(backend, "index.handler.ts"),
  backendCDKPath: join(backend, "index.ts"),
  // The production preset, except that `slidesend destroy` removes the tables with the stack. A
  // talk's data is its sessions and the audience's answers; the preset's RETAIN would keep them
  // after a destroy under fixed table names, and the next deploy of the same talk would then
  // collide with its own leftovers.
  defaults: {
    ...BlocksPresets.production,
    removalPolicy: RemovalPolicy.DESTROY,
    deletionProtection: false,
  },
  // The account is bound to the stack: CDK refuses a different one before the first write.
  env: { account: input.account, region: input.region },
});

// The deploy stops before anything ships when the backend exports more than API namespaces.
// BlocksStack.create imported the entry by this very URL, so this is that module again, not a
// second copy that would construct every block twice.
const entry = pathToFileURL(join(backend, "index.ts"));
entry.searchParams.set("stack", input.stackName);
onlyApiNamespaces(await import(entry.href));

// Loaded into `process.env` on every compute at cold start, before the backend module is imported.
for (const [name, value] of Object.entries(publicVariables(process.env))) {
  registerConfig(stack, name, value);
}

new Hosting(stack, "Web", {
  root: input.projectRoot,
  buildCommand: input.buildCommand,
  buildOutputDir: "dist",
  api: stack,
  ...(input.domain ? { domain: { domainName: input.domain, hostedZone: input.domain } } : {}),
});

// Every Lambda on Node.js 24, whatever the libraries default to.
Aspects.of(app).add(new NodeRuntimePolicy());

app.synth();
