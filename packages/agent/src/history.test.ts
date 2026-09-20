/**
 * The store keeps a turn as several rows. What the phone shows is one question and one answer —
 * with the tools the agent used folded into it, which is exactly where the original lost both
 * the steps and, in one case, the answer itself.
 */
import { describe, expect, it } from "vitest";
import { chatMessagesOf, detailOf, type StoredMessage, toChatChunk } from "./history";

const row = (
  messageId: string,
  role: string,
  content: string,
  createdAt: number,
  metadata?: StoredMessage["metadata"],
): StoredMessage => ({ messageId, role, content, createdAt, ...(metadata ? { metadata } : {}) });

describe("the conversation as it was stored", () => {
  it("folds a turn's tool calls into the answer they led to", () => {
    const messages = chatMessagesOf([
      row("1", "user", "Why does the Moon not fall?", 100),
      row("2", "tool-call", "", 110, { toolName: "search", toolInput: { q: "Moon orbit" } }),
      row("3", "tool-result", "…", 120),
      row("4", "assistant", "It does fall — it keeps missing.", 130),
    ]);
    expect(messages.map((message) => message.speaker)).toEqual(["you", "agent"]);
    expect(messages[1]).toMatchObject({
      text: "It does fall — it keeps missing.",
      steps: [{ what: "search", detail: '{"q":"Moon orbit"}' }],
    });
  });

  it("keeps the steps of an answer that never came, rather than showing nothing", () => {
    const messages = chatMessagesOf([
      row("1", "user", "And the tides?", 100),
      row("2", "tool-call", "", 110, { toolName: "search" }),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ text: "", steps: [{ what: "search" }] });
  });

  it("reads the rows in the order they happened", () => {
    const messages = chatMessagesOf([
      row("2", "assistant", "Second", 200),
      row("1", "user", "First", 100),
    ]);
    expect(messages.map((message) => message.text)).toEqual(["First", "Second"]);
  });

  it("gives a step a short detail, or none at all", () => {
    expect(detailOf({ q: "x" })).toBe('{"q":"x"}');
    expect(detailOf({})).toBeUndefined();
    expect(detailOf(undefined)).toBeUndefined();
    expect(detailOf("a".repeat(300))?.length).toBe(200);
    expect(detailOf("a".repeat(300))?.endsWith("…")).toBe(true);
  });
});

describe("a chunk on its way to the phone", () => {
  it("appends a delta and ends on done", () => {
    expect(toChatChunk({ type: "text-delta", text: "It " }, "a1")).toEqual({
      messageId: "a1",
      text: "It ",
      append: true,
    });
    expect(toChatChunk({ type: "done" }, "a1")).toMatchObject({ done: true });
  });

  it("turns a tool call into a working step", () => {
    expect(toChatChunk({ type: "tool-call", toolName: "search", input: { q: "x" } }, "a1")).toEqual(
      {
        messageId: "a1",
        text: "",
        append: true,
        step: { what: "search", detail: '{"q":"x"}' },
      },
    );
  });

  it("ends the turn on an error, with what went wrong", () => {
    expect(toChatChunk({ type: "error", error: "The model is unavailable." }, "a1")).toMatchObject({
      text: "The model is unavailable.",
      done: true,
    });
  });

  it("ignores what a reader has no use for", () => {
    expect(toChatChunk({ type: "tool-result" }, "a1")).toBeUndefined();
    expect(toChatChunk({ type: "something-new" }, "a1")).toBeUndefined();
  });
});
