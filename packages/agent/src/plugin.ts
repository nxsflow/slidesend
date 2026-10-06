import { definePlugin } from "@slidesend/core";
import { agentChatFor } from "./agent-chat";
import type { Agents } from "./agents";
import { agentMessages } from "./messages";

/** Options of the `agent` plugin. */
export interface AgentPluginOptions {
  /** The talk's agents, from `defineAgents` — the same object the backend builds blocks from. */
  agents: Agents;
}

/**
 * Installs the agent chat: `plugins: [agent({ agents })]`.
 *
 * The agents are passed here rather than discovered, so the deck's `agent:` references are
 * checked against exactly the agents the backend will have built (spec §5.2, §10).
 */
export function agent({ agents }: AgentPluginOptions) {
  return definePlugin({
    name: "agent",
    activities: [agentChatFor(agents)],
    provides: { agent: Object.keys(agents) },
    messages: agentMessages,
  });
}
