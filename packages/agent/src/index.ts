/**
 * Browser entry of `@slidesend/agent`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
export const packageName = "@slidesend/agent";

export {
  type AgentChatApi,
  agentChannel,
  agentChat,
  answerReadsMs,
  conversationTopic,
  useAgentChat,
} from "./agent-chat";
export {
  type AgentDefinition,
  type Agents,
  defineAgents,
  labelOf,
  type ModelTier,
  maxMessageChars,
  maxTurns,
} from "./agents";
export {
  type AgentStep,
  addOwnMessage,
  applyChunk,
  applyHistory,
  type ChatChunk,
  type ChatMessage,
  type ChatState,
  canSend,
  emptyChat,
  isFinished,
  type Speaker,
  turnsOf,
  withProblem,
} from "./chat";
export { agentMessages } from "./messages";
export { type AgentPluginOptions, agent } from "./plugin";
