/**
 * Turning what the agent block stored into what the phone shows (spec §10).
 *
 * The store keeps a turn as several rows: the question, every tool the agent called, every tool
 * result, and the answer. A client library that simply drops the tool rows loses the working
 * steps — and in the talk this package was extracted from it lost the ANSWER as well, because
 * that answer was written by a tool. So the folding happens here, deliberately and in one place,
 * and both halves of the tool call are kept: the name for the step, the input for its detail.
 *
 * Pure, and free of any AWS type: the shapes below are structural, so this can be tested against
 * a handful of rows instead of a model.
 */
import type { AgentStep, ChatChunk, ChatMessage } from "./chat";

/** One stored row, as the agent block returns it. */
export interface StoredMessage {
  messageId: string;
  role: string;
  content: string;
  createdAt: number;
  metadata?: { toolName?: string; toolInput?: unknown };
}

/** One chunk of a running answer, as the agent block publishes it. */
export interface StreamChunk {
  type: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  error?: string;
}

/** A tool's input as a step's detail: short, readable, and never a wall of JSON. */
export function detailOf(input: unknown, maxChars = 200): string | undefined {
  if (input === undefined || input === null) return undefined;
  const text = typeof input === "string" ? input : JSON.stringify(input);
  if (!text || text === "{}") return undefined;
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

const stepOf = (name: string | undefined, input: unknown): AgentStep => ({
  what: name ?? "tool",
  ...(detailOf(input) ? { detail: detailOf(input) as string } : {}),
});

/**
 * The conversation as the phone shows it: questions and answers, with the agent's tool calls
 * folded into the answer they led to.
 *
 * Steps collected before an answer belong to that answer. Steps left over at the end belong to
 * an answer that never arrived — they are kept as a message of their own, because showing what
 * the agent was doing beats showing nothing at all.
 */
export function chatMessagesOf(rows: readonly StoredMessage[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let steps: AgentStep[] = [];
  for (const row of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
    if (row.role === "tool-call") {
      steps.push(stepOf(row.metadata?.toolName, row.metadata?.toolInput ?? row.content));
      continue;
    }
    // A tool's result is the step's outcome, not a step of its own; it stays out of the thread.
    if (row.role === "tool-result") continue;
    if (row.role === "user") {
      messages.push({ id: row.messageId, speaker: "you", text: row.content, at: row.createdAt });
      continue;
    }
    if (row.role === "assistant") {
      messages.push({
        id: row.messageId,
        speaker: "agent",
        text: row.content,
        at: row.createdAt,
        ...(steps.length > 0 ? { steps } : {}),
      });
      steps = [];
    }
  }
  if (steps.length > 0) {
    const last = rows.at(-1);
    messages.push({
      id: `${last?.messageId ?? "steps"}-steps`,
      speaker: "agent",
      text: "",
      at: last?.createdAt ?? Date.now(),
      steps,
    });
  }
  return messages;
}

/**
 * One published chunk, as the conversation state takes it.
 *
 * `text-delta` appends, because that is what a delta is; everything else replaces. An `error`
 * chunk ends the turn rather than pretending an answer arrived — the phone shows what went
 * wrong and leaves the question standing.
 */
export function toChatChunk(chunk: StreamChunk, messageId: string): ChatChunk | undefined {
  if (chunk.type === "text-delta") {
    return { messageId, text: chunk.text ?? "", append: true };
  }
  if (chunk.type === "tool-call") {
    return { messageId, text: "", append: true, step: stepOf(chunk.toolName, chunk.input) };
  }
  if (chunk.type === "done") return { messageId, text: "", append: true, done: true };
  if (chunk.type === "error")
    return { messageId, text: chunk.error ?? "", append: true, done: true };
  // tool-result, interrupt and anything a later version adds: nothing for a reader to see.
  return undefined;
}
