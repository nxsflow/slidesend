import { defineMessages } from "@nxsflow/slidesend-core";

/** The strings the agent chat shows on a phone (spec §6.5). */
export const agentMessages = defineMessages({
  en: {
    "agent.chat.placeholder": "Ask something",
    "agent.chat.send": "Send",
    "agent.chat.steps": "{steps} working step(s)",
    "agent.chat.finished": "Thanks — that was the one question.",
    "agent.chat.showPrompt": "What is this agent told?",
    "agent.chat.monitor": "Agent chat with {agent}",
    "agent.chat.unavailable": "The agent is not available in local mode.",
  },
});
