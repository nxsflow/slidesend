/**
 * The conversation itself (spec §10), without any transport.
 *
 * A phone in a talk is not a chat window on a desk: it is locked mid-answer, put in a pocket,
 * taken out two slides later, and it reconnects to a stream that has moved on. So the state here
 * is built to be rebuilt — every message carries an id, every update is idempotent, and the
 * history the server returns always wins over what the phone thought it had.
 *
 * Everything below is a pure function over that state, so the awkward moments can be tested
 * without a model, a network or a browser.
 */

/** Who said it. */
export type Speaker = "you" | "agent";

/** One step the agent took on the way to its answer, e.g. a tool call. */
export interface AgentStep {
  /** What it did, e.g. the tool's name. */
  what: string;
  /** Its detail, already a string; the phone shows it folded away. */
  detail?: string;
}

/** One message in a conversation. */
export interface ChatMessage {
  /** Stable across a reload and a resume: the server's id for this message. */
  id: string;
  speaker: Speaker;
  text: string;
  /** When it was written, in epoch ms. */
  at: number;
  /** Whether the agent is still writing this message. */
  streaming?: boolean;
  /** The agent's working steps, shown folded away. */
  steps?: AgentStep[];
}

/** What the phone shows. */
export interface ChatState {
  messages: ChatMessage[];
  /** Whether a turn is in flight: the composer is disabled and the agent shows as writing. */
  busy: boolean;
  /** The last thing that went wrong, for the person holding the phone. */
  problem?: string;
}

export const emptyChat: ChatState = { messages: [], busy: false };

/** A chunk of a streaming answer, as the server publishes it. */
export interface ChatChunk {
  messageId: string;
  /** The text so far, or the piece to append; `append` says which. */
  text: string;
  append?: boolean;
  step?: AgentStep;
  /** The answer is complete. */
  done?: boolean;
  at?: number;
}

const byTime = (a: ChatMessage, b: ChatMessage) => a.at - b.at || a.id.localeCompare(b.id);

/**
 * Applies a chunk. Chunks arrive out of order after a reconnect and may arrive twice, so the
 * text is replaced when the server sends the whole answer so far and appended only when it says
 * so — appending a duplicate is the one mistake a reader sees immediately.
 */
export function applyChunk(state: ChatState, chunk: ChatChunk): ChatState {
  const existing = state.messages.find((message) => message.id === chunk.messageId);
  const steps = chunk.step ? [...(existing?.steps ?? []), chunk.step] : existing?.steps;
  const message: ChatMessage = {
    id: chunk.messageId,
    speaker: "agent",
    text: chunk.append ? `${existing?.text ?? ""}${chunk.text}` : chunk.text,
    at: existing?.at ?? chunk.at ?? Date.now(),
    ...(chunk.done ? {} : { streaming: true }),
    ...(steps ? { steps } : {}),
  };
  const messages = existing
    ? state.messages.map((entry) => (entry.id === message.id ? message : entry))
    : [...state.messages, message];
  return { ...state, messages: messages.sort(byTime), busy: !chunk.done };
}

/**
 * Replaces the conversation with the server's history.
 *
 * The server is the truth: a phone that was locked through three turns has nothing worth
 * keeping. The one exception is a message that is still streaming and that the history does not
 * know yet — dropping it would make the answer the reader is watching disappear.
 */
export function applyHistory(state: ChatState, history: readonly ChatMessage[]): ChatState {
  const known = new Set(history.map((message) => message.id));
  const pending = state.messages.filter((message) => message.streaming && !known.has(message.id));
  const messages = [...history, ...pending].sort(byTime);
  return { ...state, messages, busy: pending.length > 0 };
}

/** Puts the reader's own message in place before the server has answered. */
export function addOwnMessage(
  state: ChatState,
  id: string,
  text: string,
  at = Date.now(),
): ChatState {
  return {
    ...state,
    messages: [...state.messages, { id, speaker: "you" as const, text, at }].sort(byTime),
    busy: true,
    ...(state.problem ? { problem: undefined } : {}),
  };
}

/**
 * A turn that failed leaves the question standing and says what happened: the reader should be
 * able to send it again without typing it twice.
 */
export function withProblem(state: ChatState, problem: string): ChatState {
  return {
    ...state,
    busy: false,
    messages: state.messages.map((message) =>
      message.streaming ? { ...message, streaming: false } : message,
    ),
    problem,
  };
}

/** How many turns this device has taken; `maxTurns` caps it. */
export function turnsOf(state: ChatState): number {
  return state.messages.filter((message) => message.speaker === "you").length;
}

/** Whether the composer accepts anything: not while busy, not past the cap, not when empty. */
export function canSend(
  state: ChatState,
  draft: string,
  limits: { maxTurns: number; maxChars: number },
): boolean {
  const text = draft.trim();
  return (
    text.length > 0 &&
    text.length <= limits.maxChars &&
    !state.busy &&
    turnsOf(state) < limits.maxTurns
  );
}

/** In single-turn mode the conversation ends after the first answer. */
export function isFinished(state: ChatState, singleTurn: boolean): boolean {
  if (!singleTurn) return false;
  const answered = state.messages.some(
    (message) => message.speaker === "agent" && !message.streaming,
  );
  return answered && !state.busy;
}
