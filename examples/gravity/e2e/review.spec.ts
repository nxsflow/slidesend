import { type APIRequestContext, type Browser, expect, test } from "@playwright/test";
import { blocksPort, blocksSecret } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;
const key = blocksSecret;

/** A rehearsal that was actually walked through, so there is something to review. */
async function rehearsed(browser: Browser, request: APIRequestContext) {
  const rpc = async (method: string, params: unknown[]) => {
    const response = await request.post(`${base}/aws-blocks/api`, {
      data: { jsonrpc: "2.0", method: `slidesend.${method}`, params, id: 1 },
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
  const session = await rpc("sessionCreate", [
    key,
    { kind: "rehearsal", name: `Review ${Date.now()}` },
  ]);
  await rpc("sessionOpen", [key, session.id]);
  // Three steps, so the dwell of the first two is measured; the last one is still running.
  const steps: [string, number][] = [
    ["why", 0],
    ["why", 1],
    ["why", 2],
  ];
  for (const [index, [slideId, step]] of steps.entries()) {
    await rpc("cursorGoto", [key, session.id, { index, slideId, step }, "e2e"]);
  }
  await rpc("responseWrite", [session.id, "guess", "phone-1", "the hammer"]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await context.newPage();
  await desk.goto(`${base}/desk#key=${key}`);
  return { rpc, session, desk, context };
}

// Review is where a rehearsal turns into a plan — and the one place that can destroy data.
test("the Review tab measures, adopts a plan and deletes a session's data on confirmation", async ({
  browser,
  request,
}) => {
  const { rpc, session, desk, context } = await rehearsed(browser, request);
  await desk.locator("[data-history] summary").click();
  await desk.locator(`[data-session="${session.id}"] [data-review-session]`).click();
  const review = desk.locator("[data-review]");
  await expect(review).toBeVisible();

  // The steps that were left carry a measured time; the one still running does not.
  await expect(review.locator("[data-row][data-reached]")).toHaveCount(2);
  // Only a step with an activity offers an estimate of the audience's time.
  const estimate = review.locator('[data-estimate="why:2"]');
  await expect(estimate).toBeVisible();
  await estimate.fill("1:30");
  await expect(desk.locator("[data-review] header span")).toContainText("audience 1:30");

  // Adopting is deliberate, and it says so afterwards.
  await review.locator("[data-adopt]").click();
  await expect(desk.locator("[data-note]")).toContainText("Adopted");
  await expect(desk.locator("[data-plan]")).toBeVisible();
  const plan = await rpc("planGet", [key]);
  expect(Object.keys(plan.minutes).length).toBeGreaterThan(10);
  expect(plan.sessionId).toBe(session.id);

  // Deleting asks first, and the cancel really cancels.
  await review.locator("[data-delete]").click();
  await review.locator("[data-delete-cancel]").click();
  await expect(review.locator("[data-delete-confirm]")).toHaveCount(0);
  expect((await rpc("timingsList", [key, session.id])).length).toBe(2);

  // A session must be closed before its data can go; the desk says so rather than failing.
  await review.locator("[data-delete]").click();
  await review.locator("[data-delete-confirm]").click();
  await expect(desk.locator("[data-note]")).toContainText("close it before deleting");

  // Ending a rehearsal asks whether it was a timed run; "yes" keeps the times, and the desk
  // comes back to its review.
  await desk.locator("[data-back]").click();
  await desk.locator("[data-history] summary").click();
  await desk.locator(`[data-session="${session.id}"] [data-present-session]`).click();
  await desk.locator("[data-close]").click();
  await desk.locator("[data-close-timed]").click();
  await expect.poll(async () => (await rpc("timingsList", [key, session.id])).length).toBe(2);
  await expect(review).toBeVisible();

  // Now the deletion goes through, and it is verified by listing, not by announcement.
  await review.locator("[data-delete]").click();
  await review.locator("[data-delete-confirm]").click();
  await expect(desk.locator("[data-note]")).toContainText("0 timings left");
  expect(await rpc("timingsList", [key, session.id])).toEqual([]);
  // The plan belongs to the talk and survives the session it came from.
  expect(await rpc("planGet", [key])).toMatchObject({ sessionId: session.id });
  await rpc("planClear", [key]);

  await context.close();
});

// "No, discard them" is the answer that protects the plan from an untimed click-through.
test("closing a rehearsal that was not a timed run discards its times", async ({
  browser,
  request,
}) => {
  const { rpc, session, desk, context } = await rehearsed(browser, request);
  await desk.locator("[data-history] summary").click();
  await desk.locator(`[data-session="${session.id}"] [data-present-session]`).click();
  await desk.locator("[data-close]").click();
  await desk.locator("[data-close-untimed]").click();
  await expect.poll(async () => (await rpc("timingsList", [key, session.id])).length).toBe(0);
  await expect(desk.locator("[data-review] [data-empty]")).toBeVisible();
  await context.close();
});
