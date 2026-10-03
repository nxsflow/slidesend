/**
 * The awkward moments of a phone in a room: a stream that arrives twice, a lock in the middle of
 * an answer, a history that has moved on, and a turn that fails.
 */
import { describe, expect, it } from "vitest";
import {
  addOwnMessage,
  applyChunk,
  applyHistory,
  type ChatMessage,
  canSend,
  emptyChat,
  isFinished,
  turnsOf,
  withProblem,
} from "./chat";

const message = (id: string, speaker: "you" | "agent", text: string, at: number): ChatMessage => ({
  id,
  speaker,
  text,
  at,
});

describe("a conversation on a phone", () => {
  it("shows what was typed before the server has answered", () => {
    const state = addOwnMessage(emptyChat, "m1", "Why does the Moon not fall?", 1000);
    expect(state.messages).toHaveLength(1);
    expect(state.busy).toBe(true);
    expect(turnsOf(state)).toBe(1);
  });

  it("builds up a streamed answer and ends it when it is done", () => {
    let state = addOwnMessage(emptyChat, "m1", "Why?", 1000);
    state = applyChunk(state, { messageId: "a1", text: "It ", append: true, at: 1100 });
    state = applyChunk(state, { messageId: "a1", text: "does ", append: true });
    state = applyChunk(state, { messageId: "a1", text: "fall.", append: true, done: true });
    expect(state.messages.at(-1)).toMatchObject({ text: "It does fall.", speaker: "agent" });
    expect(state.messages.at(-1)?.streaming).toBeUndefined();
    expect(state.busy).toBe(false);
  });

  it("takes a whole answer as a replacement, so a repeated chunk cannot double it", () => {
    let state = applyChunk(emptyChat, { messageId: "a1", text: "It does fall.", at: 1100 });
    state = applyChunk(state, { messageId: "a1", text: "It does fall.", done: true });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.text).toBe("It does fall.");
  });

  it("collects the agent's working steps under its message", () => {
    let state = applyChunk(emptyChat, { messageId: "a1", text: "", step: { what: "search" } });
    state = applyChunk(state, {
      messageId: "a1",
      text: "Found it.",
      step: { what: "read", detail: "page 4" },
      done: true,
    });
    expect(state.messages[0]?.steps).toEqual([
      { what: "search" },
      { what: "read", detail: "page 4" },
    ]);
  });

  it("lets the server's history win after a lock, and keeps an answer still being written", () => {
    let state = addOwnMessage(emptyChat, "m1", "Why?", 1000);
    state = applyChunk(state, { messageId: "a1", text: "It d", append: true, at: 1100 });
    // The phone was locked; while it slept, the server finished this turn and saw another one.
    const history = [
      message("m1", "you", "Why?", 1000),
      message("a1", "agent", "It does fall.", 1100),
      message("m2", "you", "And the tides?", 2000),
      message("a2", "agent", "Also gravity.", 2100),
    ];
    const resumed = applyHistory(state, history);
    expect(resumed.messages.map((entry) => entry.id)).toEqual(["m1", "a1", "m2", "a2"]);
    expect(resumed.messages[1]?.text).toBe("It does fall.");
    expect(resumed.busy).toBe(false);
  });

  it("does not drop an answer the reader is watching arrive", () => {
    let state = addOwnMessage(emptyChat, "m3", "One more?", 3000);
    state = applyChunk(state, { messageId: "a3", text: "Yes", append: true, at: 3100 });
    // The history was read before this turn reached the store.
    const resumed = applyHistory(state, [message("m3", "you", "One more?", 3000)]);
    expect(resumed.messages.map((entry) => entry.id)).toEqual(["m3", "a3"]);
    expect(resumed.busy).toBe(true);
  });

  it("leaves the question standing when a turn fails, and says why", () => {
    let state = addOwnMessage(emptyChat, "m1", "Why?", 1000);
    state = applyChunk(state, { messageId: "a1", text: "It", append: true });
    const failed = withProblem(state, "The session is closed.");
    expect(failed.problem).toBe("The session is closed.");
    expect(failed.busy).toBe(false);
    expect(failed.messages.every((entry) => !entry.streaming)).toBe(true);
  });

  it("clears the problem as soon as something new is sent", () => {
    const failed = withProblem(addOwnMessage(emptyChat, "m1", "Why?", 1000), "no");
    expect(addOwnMessage(failed, "m2", "Again", 2000).problem).toBeUndefined();
  });
});

describe("what the composer allows", () => {
  const limits = { maxTurns: 2, maxChars: 10 };

  it("refuses empty, too long, busy and used up", () => {
    expect(canSend(emptyChat, "  ", limits)).toBe(false);
    expect(canSend(emptyChat, "way too long a message", limits)).toBe(false);
    expect(canSend(emptyChat, "Why?", limits)).toBe(true);
    expect(canSend({ ...emptyChat, busy: true }, "Why?", limits)).toBe(false);
    let used = addOwnMessage(emptyChat, "m1", "a", 1);
    used = addOwnMessage({ ...used, busy: false }, "m2", "b", 2);
    expect(canSend({ ...used, busy: false }, "Why?", limits)).toBe(false);
  });

  it("ends a single-turn conversation after the first answer", () => {
    let state = addOwnMessage(emptyChat, "m1", "Why?", 1000);
    expect(isFinished(state, true)).toBe(false);
    state = applyChunk(state, { messageId: "a1", text: "Because.", done: true });
    expect(isFinished(state, true)).toBe(true);
    expect(isFinished(state, false)).toBe(false);
  });
});
