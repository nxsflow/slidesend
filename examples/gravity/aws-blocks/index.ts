/**
 * The example talk's backend on AWS Blocks. AWS Blocks needs the talk project to own this file,
 * and it serves every export of it to anyone, under the export's name (spec §4.1). So export ONLY
 * API namespaces (here `slidesend` and `agentChat`): never the Scope, building blocks, the backend
 * object, helpers or configuration, and no `export *`. `index.handler.ts` refuses to start
 * otherwise, as do dev and deploy.
 */
import { Scope } from "@aws-blocks/blocks";
import { createAgentChat } from "@slidesend/agent/server";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";
import { agents } from "../src/agents";
import { newtonTools } from "./tools";

// snippet: aws-backend
const scope = new Scope("gravity");
const backend = createAwsBackend(scope, config);
export const slidesend = backend.api;

// The agent chat's own namespace: one Agent block per defined agent, wired by explicit
// composition rather than discovered.
export const agentChat = createAgentChat(scope, {
  agents,
  platform: backend.platform,
  guards: backend.server.sessions.guards,
  tools: { newton: newtonTools },
}).api;
// end snippet
