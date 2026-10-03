/**
 * The agent chat activity (spec §10): a conversation on the phone, with the talk's own agent.
 *
 * The phone is the hard part, not the model. It is locked mid-answer and woken two slides later,
 * it loses its connection in a room full of people, and its owner is also listening to a talk —
 * so the UI is deliberately small: what was said, what is being written, and one box to write
 * in. The agent's working steps are there, folded away, because in a talk ABOUT agents they are
 * the point; in any other talk nobody opens them.
 *
 * Everything that survives a lock lives on the server. This component only renders what
 * `chat.ts` computed and re-asks for the history whenever the window comes back.
 */
import {
  activityMeta,
  cssVariable,
  defineActivity,
  namespaced,
  ref,
  typedClient,
  useActivityScope,
  useText,
} from "@slidesend/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { maxMessageChars, maxTurns } from "./agents";
import {
  addOwnMessage,
  applyChunk,
  applyHistory,
  type ChatMessage,
  type ChatState,
  canSend,
  emptyChat,
  isFinished,
  withProblem,
} from "./chat";
import { type StreamChunk, toChatChunk } from "./history";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/** The channel the server half publishes an answer on, and the topic of one conversation. */
export const agentChannel = "agentChat.channel";
/**
 * Which conversation of which agent the chunks belong to. The segments are the arguments of the
 * server's `channel` method, session id first, so it is guarded like everything else (spec §9).
 */
export const conversationTopic = (sessionId: string, agentName: string, channelId: string) =>
  `${sessionId}/${agentName}/${channelId}`;

/** The server methods the phone calls, in the plugin's own API namespace (spec §4.1). */
export interface AgentChatApi {
  /** This device's conversation, created if it is new, plus everything said in it. */
  start(
    sessionId: string,
    activityId: string,
    deviceId: string,
    agentName: string,
  ): Promise<{ messages: ChatMessage[]; channelId: string; turns: number }>;
  /** Sends a turn; the answer arrives on the channel this device is already subscribed to. */
  send(
    sessionId: string,
    activityId: string,
    deviceId: string,
    agentName: string,
    text: string,
  ): Promise<{ channelId: string }>;
  /** The agent's system prompt, if the talk allows the audience to read it. */
  prompt(sessionId: string, agentName: string): Promise<string | undefined>;
}

/** What the phone shows and what it can do, for the component and for tests. */
/**
 * Reads of the conversation after a message was sent, in ms. The answer streams over the channel,
 * but a chunk published before the phone's subscription stands is lost — the subscription can
 * still be settling when someone taps a suggestion at once. The history has the answer either way.
 */
export const answerReadsMs = [2_000, 5_000, 10_000, 20_000] as const;

export function useAgentChat(options: { agent: string; singleTurn: boolean }): {
  state: ChatState;
  send(text: string): Promise<void>;
  prompt?: string;
  showPrompt(): Promise<void>;
  ready: boolean;
} {
  const scope = useActivityScope();
  const [state, setState] = useState<ChatState>(emptyChat);
  const [prompt, setPrompt] = useState<string>();
  const client = useMemo(
    () =>
      scope?.platform
        ? (typedClient(namespaced(scope.platform, "agentChat")) as unknown as AgentChatApi)
        : undefined,
    [scope],
  );
  const [channelId, setChannelId] = useState<string>();
  // The id the chunks of the turn in flight belong to; the history's own ids take over after it.
  const pending = useRef<string>(undefined);
  const answerReads = useRef<ReturnType<typeof setTimeout>[]>([]);
  const load = useCallback(() => {
    if (!client || !scope) return;
    client.start(scope.sessionId, scope.activityId, scope.deviceId, options.agent).then(
      (conversation) => {
        setChannelId(conversation.channelId);
        setState((current) => applyHistory(current, conversation.messages));
      },
      () => {},
    );
  }, [client, scope, options.agent]);

  // The conversation is re-read on mount, on every reconnect and whenever the page comes back:
  // a phone that was locked has missed both the answer and the chunks that carried it.
  useEffect(() => {
    if (!client || !scope?.platform) return;
    load();
    const stopStatus = scope.platform.onStatus((connected) => {
      if (connected) load();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopStatus();
      document.removeEventListener("visibilitychange", onVisible);
      for (const timer of answerReads.current) clearTimeout(timer);
    };
  }, [client, scope, load]);

  // The subscription stands before anything is sent: a chunk published before it is gone, and
  // the reader would watch an empty bubble while the answer went past.
  useEffect(() => {
    if (!scope?.platform || !channelId) return;
    return scope.platform.subscribe(
      agentChannel,
      conversationTopic(scope.sessionId, options.agent, channelId),
      (message) => {
        const chunk = toChatChunk(message as StreamChunk, pending.current ?? channelId);
        if (chunk) setState((current) => applyChunk(current, chunk));
      },
    );
  }, [scope, channelId, options.agent]);

  const send = useCallback(
    async (text: string) => {
      if (!client || !scope) return;
      const id = `local-${Date.now()}`;
      pending.current = `${id}-answer`;
      setState((current) => addOwnMessage(current, id, text));
      try {
        await client.send(scope.sessionId, scope.activityId, scope.deviceId, options.agent, text);
        for (const timer of answerReads.current) clearTimeout(timer);
        answerReads.current = answerReadsMs.map((ms) => setTimeout(load, ms));
      } catch (error) {
        setState((current) =>
          withProblem(current, error instanceof Error ? error.message : String(error)),
        );
      }
    },
    [client, scope, options.agent, load],
  );

  const showPrompt = useCallback(async () => {
    if (!client || !scope) return;
    const found = await client.prompt(scope.sessionId, options.agent).catch(() => undefined);
    setPrompt(found ?? undefined);
  }, [client, scope, options.agent]);

  return {
    state,
    send,
    ...(prompt ? { prompt } : {}),
    showPrompt,
    ready: Boolean(client) && !isFinished(state, options.singleTurn),
  };
}

/** One message, as the phone shows it. */
function Message({ message }: { message: ChatMessage }) {
  const text = useText();
  const [open, setOpen] = useState(false);
  const mine = message.speaker === "you";
  return (
    <li
      data-message={message.id}
      data-speaker={message.speaker}
      style={{
        listStyle: "none",
        alignSelf: mine ? "end" : "start",
        maxWidth: "85%",
        padding: "10px 12px",
        borderRadius: 14,
        background: mine ? color("accent") : color("surface"),
        color: mine ? color("background") : color("text"),
        whiteSpace: "pre-wrap",
      }}
    >
      {message.text}
      {message.streaming && <span data-streaming> …</span>}
      {message.steps && message.steps.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            data-steps-toggle
            onClick={() => setOpen((value) => !value)}
            style={{
              font: "inherit",
              fontSize: 12,
              background: "transparent",
              border: "none",
              padding: 0,
              color: color("textMuted"),
              cursor: "pointer",
            }}
          >
            {text("agent.chat.steps", { steps: message.steps.length })}
          </button>
          {open && (
            <ul data-steps style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
              {message.steps.map((step) => (
                <li key={`${step.what}:${step.detail ?? ""}`}>
                  {step.what}
                  {step.detail ? `: ${step.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The agent chat as a deck uses it: `agentChat({ id: "ask", agent: "newton" })`.
 *
 * `agent` is a reference (spec §5.2), so a deck that names an agent nobody defined fails to
 * load, with the name in the message — rather than at the moment someone in the room asks it
 * something.
 */
export const agentChat = defineActivity({
  type: "agentChat",
  schema: z.object({
    id: z.string(),
    /** Which of the talk's agents answers here. */
    agent: ref("agent"),
    /** End the conversation after the first answer. */
    singleTurn: z.boolean().default(false),
    /** Questions offered as buttons, so nobody has to think of one first. */
    suggestions: z.array(z.string().min(1)).default([]),
    ...activityMeta,
  }),
  Participant: ({ data }) => {
    const text = useText();
    const { state, send, prompt, showPrompt, ready } = useAgentChat({
      agent: data.agent,
      singleTurn: data.singleTurn,
    });
    const [draft, setDraft] = useState("");
    const limits = { maxTurns, maxChars: maxMessageChars };
    const sendable = canSend(state, draft, limits) && ready;

    const submit = async (value: string) => {
      if (!canSend(state, value, limits) || !ready) return;
      setDraft("");
      await send(value);
    };

    return (
      <section
        data-activity-kind="agentChat"
        data-agent={data.agent}
        style={{ display: "grid", gap: 12 }}
      >
        <ul
          data-messages
          style={{ display: "grid", gap: 8, margin: 0, padding: 0, justifyItems: "start" }}
        >
          {state.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </ul>

        {state.messages.length === 0 && data.suggestions.length > 0 && (
          <div data-suggestions style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                data-suggestion
                onClick={() => submit(suggestion)}
                style={{
                  font: "inherit",
                  fontSize: 14,
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${color("border")}`,
                  background: "transparent",
                  color: color("text"),
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {state.problem && (
          <p data-problem style={{ margin: 0, color: color("textMuted") }}>
            {state.problem}
          </p>
        )}

        {ready ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(draft);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              data-composer
              value={draft}
              maxLength={maxMessageChars}
              disabled={state.busy}
              placeholder={text("agent.chat.placeholder")}
              aria-label={text("agent.chat.placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              style={{
                font: "inherit",
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${color("border")}`,
                background: color("surface"),
                color: color("text"),
              }}
            />
            <button
              type="submit"
              data-send
              disabled={!sendable}
              style={{
                font: "inherit",
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: color("accent"),
                color: color("background"),
                opacity: sendable ? 1 : 0.5,
              }}
            >
              {text("agent.chat.send")}
            </button>
          </form>
        ) : (
          <p data-finished style={{ margin: 0, color: color("textMuted") }}>
            {text("agent.chat.finished")}
          </p>
        )}

        <div>
          <button
            type="button"
            data-show-prompt
            onClick={() => void showPrompt()}
            style={{
              font: "inherit",
              fontSize: 12,
              background: "transparent",
              border: "none",
              padding: 0,
              color: color("textMuted"),
            }}
          >
            {text("agent.chat.showPrompt")}
          </button>
          {prompt && (
            <pre
              data-prompt
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                margin: "8px 0 0",
                color: color("textMuted"),
              }}
            >
              {prompt}
            </pre>
          )}
        </div>
      </section>
    );
  },
  /** The desk's tile: how many phones are talking to this agent, and their last question. */
  Monitor: ({ data }) => {
    const text = useText();
    return (
      <div data-monitor="agentChat" style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13 }}>{text("agent.chat.monitor", { agent: data.agent })}</span>
      </div>
    );
  },
});
