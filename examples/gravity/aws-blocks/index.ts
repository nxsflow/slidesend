/**
 * The example talk's backend on AWS Blocks. AWS Blocks needs the talk project to own this file,
 * and it takes the name of each exported variable as an API namespace (spec §4.1).
 */
import { Scope } from "@aws-blocks/blocks";
import { createAgentChat } from "@slidesend/agent/server";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";
import { agents } from "../src/agents";

const scope = new Scope("gravity");
const backend = createAwsBackend(scope, config);
export const slidesend = backend.api;

// The agent chat's own namespace: one Agent block per defined agent, wired by explicit
// composition rather than discovered (spec §4.1, D4).
export const agentChat = createAgentChat(scope, {
  agents,
  platform: backend.platform,
  guards: backend.server.sessions.guards,
}).api;
