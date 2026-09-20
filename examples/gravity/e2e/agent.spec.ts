import { type APIRequestContext, expect, test } from "@playwright/test";
import { blocksPort, blocksSecret } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;
const key = blocksSecret;

/** The Blocks dev server runs the agent on its canned provider: real streaming, invented words. */
function rpcOf(request: APIRequestContext) {
  return async (method: string, params: unknown[]) => {
    const response = await request.post(`${base}/aws-blocks/api`, {
      data: { jsonrpc: "2.0", method, params, id: 1 },
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
}

// Everything a phone does with an agent, against the canned provider — no model, real plumbing.
test("a phone talks to the agent, and finds the conversation again after a lock", async ({
  request,
}) => {
  const rpc = rpcOf(request);
  const session = await rpc("slidesend.sessionCreate", [
    key,
    { kind: "rehearsal", name: `Agent ${Date.now()}` },
  ]);
  await rpc("slidesend.sessionOpen", [key, session.id]);
  const device = `phone-${Date.now()}`;

  // The conversation exists before anything is sent, so the phone can subscribe first.
  const started = await rpc("agentChat.start", [session.id, "ask-newton", device, "newton"]);
  expect(started.channelId).toBeTruthy();
  expect(started.messages).toEqual([]);
  expect(started.turns).toBe(0);

  await rpc("agentChat.send", [
    session.id,
    "ask-newton",
    device,
    "newton",
    "Why does the Moon not fall down?",
  ]);

  // The answer is written while the phone is away; asking again is what a reload does.
  await expect
    .poll(
      async () => {
        const again = await rpc("agentChat.start", [session.id, "ask-newton", device, "newton"]);
        return again.messages.filter((message: { speaker: string }) => message.speaker === "agent")
          .length;
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const resumed = await rpc("agentChat.start", [session.id, "ask-newton", device, "newton"]);
  expect(resumed.turns).toBe(1);
  expect(resumed.channelId).toBe(started.channelId);
  expect(resumed.messages[0]).toMatchObject({
    speaker: "you",
    text: "Why does the Moon not fall down?",
  });
  expect(resumed.messages.at(-1)?.speaker).toBe("agent");
  expect(String(resumed.messages.at(-1)?.text).length).toBeGreaterThan(0);

  // Another device gets its own conversation, not this one.
  const other = await rpc("agentChat.start", [session.id, "ask-newton", `${device}-2`, "newton"]);
  expect(other.channelId).not.toBe(started.channelId);
  expect(other.messages).toEqual([]);

  // The talk allows this prompt to be read; that is the talk's decision, not the tool's.
  const prompt = await rpc("agentChat.prompt", [session.id, "newton"]);
  expect(prompt).toContain("Isaac Newton");

  // A closed session can spend nothing: the refusal comes before any model call.
  await rpc("slidesend.sessionClose", [key, session.id]);
  await expect(
    rpc("agentChat.send", [session.id, "ask-newton", device, "newton", "One more?"]),
  ).rejects.toThrow(/not open/i);
  await expect(
    rpc("agentChat.start", [session.id, "ask-newton", device, "newton"]),
  ).rejects.toThrow(/not open/i);
});

// The phone's own view of the same thing: a question typed in, an answer arriving.
test("the chat on a phone shows the answer arriving and survives a reload", async ({
  browser,
  request,
}) => {
  const rpc = rpcOf(request);
  const session = await rpc("slidesend.sessionCreate", [
    key,
    { kind: "rehearsal", name: `Agent UI ${Date.now()}` },
  ]);
  await rpc("slidesend.sessionOpen", [key, session.id]);
  // The chat is the deck's last step.
  await rpc("slidesend.cursorGoto", [
    key,
    session.id,
    { index: 18, slideId: "together", step: 9 },
    "e2e",
  ]);
  const join = await rpc("slidesend.sessionJoin", [key, session.id]);

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await context.newPage();
  await phone.goto(`${base}${join.joinPath}`);
  const chat = phone.locator('[data-activity-kind="agentChat"]');
  await expect(chat).toBeVisible({ timeout: 30_000 });

  // A suggestion is there so nobody has to think of a question first.
  await chat.locator("[data-suggestion]").first().click();
  await expect(chat.locator('[data-speaker="you"]')).toHaveCount(1);
  await expect(chat.locator('[data-speaker="agent"]').first()).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await chat.locator('[data-speaker="agent"]').first().innerText()).length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(10);

  // Single-turn: when the answer is there, the composer is gone.
  await expect(chat.locator("[data-finished]")).toBeVisible({ timeout: 30_000 });
  await expect(chat.locator("[data-composer]")).toHaveCount(0);

  // A reload is the mildest form of a locked phone: the conversation is still there.
  await phone.reload();
  await expect(phone.locator('[data-speaker="you"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(phone.locator('[data-speaker="agent"]').first()).toBeVisible();

  await context.close();
});
