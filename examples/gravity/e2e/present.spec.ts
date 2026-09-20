import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { blocksPort, blocksSecret } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;
const key = blocksSecret;

const current = (page: Page) => page.locator("[data-slide-id][data-presence]:not([aria-hidden])");

async function deskOnSession(browser: Browser, request: APIRequestContext) {
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
    { kind: "rehearsal", name: `Present ${Date.now()}` },
  ]);
  await rpc("sessionOpen", [key, session.id]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await context.newPage();
  await desk.goto(`${base}/desk#key=${key}`);
  await desk.locator(`[data-session="${session.id}"] button`).first().click();
  await desk.locator('[data-tab="present"]').click();
  return { rpc, session, desk, context };
}

// The speaker's own view: it steers, it shows what the room sees, and nothing here destroys data.
test("the Present tab steers the talk from the keyboard and shows the room", async ({
  browser,
  request,
}) => {
  const { rpc, session, desk, context } = await deskOnSession(browser, request);

  // Without a stage, the preview area says so and offers to open one.
  await expect(desk.locator("[data-no-stage]")).toBeVisible();
  const [stage] = await Promise.all([
    context.waitForEvent("page"),
    desk.locator("[data-present] [data-open-stage]").click(),
  ]);
  await stage.waitForLoadState();
  await expect(desk.locator("[data-preview]").first()).toBeVisible({ timeout: 30_000 });
  await expect(desk.locator("[data-no-stage]")).toHaveCount(0);

  // A phone joins, and the keyboard alone moves everyone along.
  const phone = await (
    await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true })
  ).newPage();
  await phone.goto(`${base}/r/${session.joinToken}`);

  await desk.locator("[data-present]").click();
  await desk.keyboard.press("ArrowRight");
  await desk.keyboard.press("ArrowRight");
  await expect(desk.locator("[data-position]")).toContainText("3 / 19");
  await expect.poll(async () => current(stage).getAttribute("data-step")).toBe("2");
  await expect(phone.locator('[data-activity="guess"]')).toBeVisible();
  // The phone is counted on the desk.
  await expect(desk.locator("[data-status]")).toContainText("1 phone(s)", { timeout: 30_000 });

  // The clock starts with the first forward step.
  await expect(desk.locator("[data-clock]")).toHaveAttribute(
    "data-tone",
    /ahead|onTime|behind|late/,
  );
  await expect(desk.locator("[data-clock]")).not.toContainText("elapsed 0:00");
  expect(
    (await rpc("sessionList", [key])).find((s: { id: string }) => s.id === session.id).startedAt,
  ).toBeGreaterThan(0);

  // The jump overlay opens with G, jumps, and closes itself.
  await desk.keyboard.press("g");
  await expect(desk.locator("[data-jump]")).toBeVisible();
  await desk.locator('[data-jump-to="falling-1"]').click();
  await expect(desk.locator("[data-jump]")).toHaveCount(0);
  await expect(desk.locator("[data-position]")).toContainText("Everything falls at the same rate");
  await expect.poll(async () => current(stage).getAttribute("data-slide-id")).toBe("falling-1");

  // The shortcuts list opens and closes from the keyboard.
  await desk.keyboard.press("?");
  await expect(desk.locator("[data-shortcut-list]")).toBeVisible();
  await desk.keyboard.press("Escape");
  await expect(desk.locator("[data-shortcut-list]")).toHaveCount(0);

  // Notes and cue of the current step, and the phone tile.
  await expect(desk.locator("[data-notes]")).toBeVisible();
  await expect(desk.locator("[data-status]")).toContainText("Rehearsal");

  await rpc("sessionClose", [key, session.id]);
  await context.close();
  await phone.context().close();
});
