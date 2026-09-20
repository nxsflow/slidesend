/**
 * Server entry of `@slidesend/agent` (spec §10). Code that must not reach a browser bundle.
 *
 * One Agent block per defined agent, because the blocks keep their conversations in tables of
 * their own: two agents in one block could not be told apart afterwards. Block ids are short —
 * they end up in an S3 bucket name, which stops at 63 characters.
 *
 * Every method that can cost money starts with the open-session guard (spec §9). A talk that is
 * over must not be able to spend anything, and "over" is core's judgement, not this package's.
 */
import { Agent, ApiNamespace, BedrockModels, type Scope } from "@aws-blocks/blocks";
import type { PlatformServer, Store } from "@slidesend/core";
import { type Guards, session } from "@slidesend/core/server";
import { z } from "zod";
import { type Agents, maxMessageChars, maxTurns } from "./agents";
import type { ChatMessage } from "./chat";
import { chatMessagesOf, type StoredMessage } from "./history";

/** What one conversation is: a device's chat with one agent in one session. */
const conversationSchema = z.object({
  conversationId: z.string(),
  agent: z.string(),
  /** How many turns this device has taken; the cap is enforced here, not on the phone. */
  turns: z.number().int().min(0),
  startedAt: z.number(),
});

type Conversation = z.output<typeof conversationSchema>;

/** The block id of an agent: short on purpose, see the file header. */
export const blockIdOf = (name: string) => `ag-${name}`;

/** Options of `createAgentChat`. */
export interface AgentChatOptions {
  /** The talk's agents — the same object the deck's plugin was given. */
  agents: Agents;
  /** Core's platform on this backend: the store for conversations, and its guards. */
  platform: PlatformServer;
  guards: Guards;
}

/** What `createAgentChat` returns; export `api` from the project's `aws-blocks/index.ts`. */
export interface AgentChatBackend {
  /** The API namespace to export as `agentChat`. */
  api: unknown;
  /** The methods, for tests and for other backend code. */
  methods: Record<string, (...args: never[]) => unknown>;
  /** The Agent blocks, by agent name. */
  blocks: Record<string, Agent>;
}

/**
 * Builds the agent chat's backend inside the talk project's scope.
 *
 * ```ts
 * // aws-blocks/index.ts
 * const backend = createAwsBackend(scope, config);
 * export const slidesend = backend.api;
 * export const agentChat = createAgentChat(scope, {
 *   agents,
 *   platform: backend.platform,
 *   guards: backend.server.guards,
 * }).api;
 * ```
 *
 * The agents are passed explicitly rather than discovered: the deck's references were checked
 * against this very object (spec §5.2), and a registry that guessed could disagree with it.
 */
export function createAgentChat(scope: Scope, options: AgentChatOptions): AgentChatBackend {
  const { agents, platform, guards } = options;
  const conversations: Store<Conversation> = platform.store("agentchat", conversationSchema);

  const blocks: Record<string, Agent> = {};
  for (const [name, definition] of Object.entries(agents)) {
    blocks[name] = new Agent(scope, blockIdOf(name), {
      systemPrompt: definition.systemPrompt,
      // The model chain is the platform's business, not the talk's: a talk asks for `fast` or
      // `smart`. Locally there is no chain at all — the block falls back to its canned provider,
      // which streams for real, so everything but the wording can be tested without Bedrock.
      model: {
        deployed:
          definition.model === "smart"
            ? [BedrockModels.SMART, BedrockModels.BALANCED]
            : [BedrockModels.FAST, BedrockModels.BALANCED],
      },
      ...(definition.tools ? { tools: definition.tools as never } : {}),
      // Token streaming, so the phone shows the answer arriving rather than a spinner.
      streamingMode: "token",
      conversation: { strategy: "sliding-window", windowSize: 2 * maxTurns },
    });
  }

  const key = (sessionId: string, activityId: string, deviceId: string) =>
    `${sessionId}/${activityId}/${deviceId}`;

  function blockOf(name: string): Agent {
    const block = blocks[name];
    if (!block) throw new Error(`No agent "${name}" is defined in this talk.`);
    return block;
  }

  /** The conversation of this device, created on the first turn. */
  async function conversationOf(
    sessionId: string,
    activityId: string,
    deviceId: string,
    agentName: string,
  ): Promise<Conversation> {
    const found = await conversations.get(key(sessionId, activityId, deviceId));
    if (found && found.agent === agentName) return found;
    const conversationId = await blockOf(agentName).createConversationId(deviceId);
    const created: Conversation = {
      conversationId,
      agent: agentName,
      turns: 0,
      startedAt: platform.now(),
    };
    await conversations.put(key(sessionId, activityId, deviceId), created);
    return created;
  }

  const methods = {
    /**
     * The channel a turn's chunks arrive on, as a descriptor the browser's client middleware
     * turns into a live subscription. It is fetched BEFORE a turn is sent: a chunk published
     * before the subscription stands is gone.
     */
    // The session id is the guard's business, not the method's; it is checked before this runs.
    channel: session(guards, async (_sessionId: string, agentName: string, channelId: string) => {
      if (!agentName || !channelId) throw new Error("A channel needs an agent and a conversation.");
      return blockOf(agentName).getChannel(channelId);
    }),

    /**
     * The conversation this device is in, created if this is its first look at the activity, and
     * everything said in it so far.
     *
     * It is ONE call rather than "create" and "history", because the phone must know the channel
     * before it sends anything: a chunk published before the subscription stands is gone, and a
     * reader would watch an empty bubble while the answer went past.
     */
    start: session(
      guards,
      async (
        sessionId: string,
        activityId: string,
        deviceId: string,
        agentName: string,
      ): Promise<{ messages: ChatMessage[]; channelId: string; turns: number }> => {
        const conversation = await conversationOf(sessionId, activityId, deviceId, agentName);
        const rows =
          conversation.turns > 0
            ? ((await blockOf(agentName).getConversation(conversation.conversationId, {
                limit: 200,
              })) as unknown as StoredMessage[])
            : [];
        return {
          messages: chatMessagesOf(rows),
          channelId: conversation.conversationId,
          turns: conversation.turns,
        };
      },
    ),

    /**
     * One turn. It returns as soon as the model is running; the answer arrives on the channel,
     * which the phone is already subscribed to.
     */
    send: session(
      guards,
      async (
        sessionId: string,
        activityId: string,
        deviceId: string,
        agentName: string,
        message: string,
      ): Promise<{ channelId: string }> => {
        const text = z.string().trim().min(1).max(maxMessageChars).parse(message);
        const conversation = await conversationOf(sessionId, activityId, deviceId, agentName);
        if (conversation.turns >= maxTurns) {
          throw new Error(`This conversation has reached its ${maxTurns} turns.`);
        }
        // Counted before the model runs: a turn that fails still cost something, and a phone
        // that retries in a loop must not be able to spend without limit.
        await conversations.put(key(sessionId, activityId, deviceId), {
          ...conversation,
          turns: conversation.turns + 1,
        });
        const result = await blockOf(agentName).stream(text, {
          conversationId: conversation.conversationId,
          // The channel is the conversation, so a phone that comes back mid-answer is still
          // subscribed to the right one.
          channelId: conversation.conversationId,
          userId: deviceId,
        });
        return { channelId: result.channelId };
      },
    ),

    /**
     * The agent's system prompt — only when the talk said the audience may read it. A prompt
     * carries names, instructions and a tone nobody meant to publish, so this is off by default.
     */
    prompt: session(guards, async (_sessionId: string, agentName: string) => {
      const definition = agents[agentName];
      return definition?.showPrompt ? definition.systemPrompt : undefined;
    }),
  };

  const api = new ApiNamespace(scope, "agentChat", () => methods);
  return { api, methods: methods as AgentChatBackend["methods"], blocks };
}
