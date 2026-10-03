import { type Browser, expect, type Page, test } from "@playwright/test";
import { blocksPort, blocksSecret } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;

const label = (page: Page, name: string) =>
  page.evaluate((value) => window.localStorage.setItem("slidesend.device-label", value), name);

/**
 * A desk page in its own browser context. Playwright keeps contexts open until the worker ends,
 * and a desk that is still running keeps beating on the newest session, so every test closes its
 * own contexts.
 */
async function openDesk(
  browser: Browser,
  key: string,
  options: { label?: string; viewport?: { width: number; height: number } } = {},
) {
  const context = await browser.newContext(options.viewport ? { viewport: options.viewport } : {});
  const page = await context.newPage();
  if (options.label) {
    await page.goto(base);
    await label(page, options.label);
  }
  await page.goto(`${base}/desk#key=${key}`);
  return { page, context, close: () => context.close() };
}

test("the desk takes control from the address and cleans it up", async ({ browser }) => {
  const key = blocksSecret;
  const { page: desk, close } = await openDesk(browser, key);
  await expect(desk.locator("[data-desk]")).toHaveAttribute("data-control", "true");
  await expect(desk.locator("[data-control-state]")).toHaveAttribute(
    "data-control-state",
    "control",
  );
  expect(desk.url()).not.toContain(key);
  expect(desk.url()).toBe(`${base}/desk`);
  await close();
});

test("a wrong key leaves the desk view only, and the right one takes control", async ({
  browser,
}) => {
  const key = blocksSecret;
  const context = await browser.newContext();
  const desk = await context.newPage();
  await desk.goto(`${base}/desk#key=not-the-secret`);
  await expect(desk.locator("[data-control-state]")).toHaveAttribute(
    "data-control-state",
    "view-only",
  );
  // A browser without the key is told where the key comes from.
  await expect(desk.locator("[data-take-control]")).toContainText("#key=");
  await desk.getByLabel("Control key").fill("still wrong");
  await desk.getByRole("button", { name: "Take control" }).click();
  await expect(desk.locator("[data-wrong]")).toBeVisible();

  await desk.getByLabel("Control key").fill(key);
  await desk.getByRole("button", { name: "Take control" }).click();
  await expect(desk.locator("[data-desk]")).toHaveAttribute("data-control", "true");
  await expect(desk.locator("[data-start]")).toHaveCount(2);
  await context.close();
});

// The whole way a first-time speaker takes: one click to rehearse, present, end, review.
test("a rehearsal starts in one click, presents, and ends in its review", async ({ browser }) => {
  const key = blocksSecret;
  const first = await openDesk(browser, key, {
    label: "Lectern laptop",
    viewport: { width: 1280, height: 800 },
  });
  const desk = first.page;

  // The start page is usable at 1280×800 without scrolling sideways.
  await expect(desk.locator("[data-meta]")).toContainText("22 steps");
  const overflow = await desk.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // One click: created, opened and presenting, with this rehearsal's own join address.
  await desk.locator('[data-start="rehearsal"]').click();
  await expect(desk.locator("[data-present]")).toBeVisible();
  await expect(desk.locator("[data-status]")).toContainText("Rehearsal");
  await expect(desk.locator("a[data-join]")).toHaveAttribute("href", /\/r\/[0-9a-f]+$/);

  const sessionId = (await desk
    .locator("[data-present]")
    .getAttribute("data-session-id")) as string;

  // Back on the start page, a running session is offered first (other checks may leave theirs
  // running too), and a new one can still be started.
  await desk.locator("[data-back]").click();
  await expect(desk.locator("[data-running]")).toBeVisible();
  await expect(desk.locator("[data-start]")).toHaveCount(2);

  // A second desk on the same session is named in a warning, with its label.
  const other = await openDesk(browser, key, { label: "Back of the room" });
  await other.page.locator("[data-history] summary").click();
  await other.page.locator(`[data-session="${sessionId}"] [data-present-session]`).click();
  await expect(other.page.locator("[data-present]")).toBeVisible();
  // Other checks may leave desks of their own running, so look for this one by its label.
  await expect(desk.getByText("Another desk is on this session: Back of the room.")).toBeVisible({
    timeout: 30_000,
  });
  await other.close();

  // Ending a rehearsal asks whether it was a timed run before anything is closed (spec §13),
  // and then shows what it measured.
  await desk.locator("[data-history] summary").click();
  await desk.locator(`[data-session="${sessionId}"] [data-present-session]`).click();
  await desk.locator("[data-close]").click();
  await expect(desk.locator("[data-ending]")).toBeVisible();
  await desk.locator("[data-close-timed]").click();
  await expect(desk.locator("[data-review]")).toBeVisible();
  await desk.locator("[data-back]").click();
  await desk.locator("[data-history] summary").click();
  await expect(desk.locator(`[data-session="${sessionId}"]`)).toHaveAttribute(
    "data-state",
    "closed",
  );
  await first.close();
});

test("a talk planned for later opens by itself, and the plan can be cancelled", async ({
  browser,
}) => {
  const key = blocksSecret;
  const { page: desk, close } = await openDesk(browser, key);
  const name = `Planned ${Date.now()}`;
  await desk.locator("[data-plan-later] summary").click();
  // A start a day ahead, in the local time the field takes.
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await desk.getByLabel("Start", { exact: true }).fill(local);
  await desk.getByLabel("Kind", { exact: true }).selectOption("rehearsal");
  await desk.getByLabel("Name (optional)").fill(name);
  await desk.locator("[data-plan-submit]").click();
  await desk.locator("[data-history] summary").click();
  const session = desk.locator("li", { hasText: name });
  await expect(session).toHaveAttribute("data-state", "armed");
  await expect(session).toContainText("opens at");
  await session.locator("[data-disarm]").click();
  await expect(session).toHaveAttribute("data-state", "draft");
  await close();
});

test("the desk opens the stage, already authorized and on the presented session", async ({
  browser,
}) => {
  const key = blocksSecret;
  const { page: desk, context, close } = await openDesk(browser, key);
  await desk.locator('[data-start="rehearsal"]').click();
  await expect(desk.locator("[data-no-stage]")).toBeVisible();

  const [stage] = await Promise.all([
    context.waitForEvent("page"),
    desk.locator("[data-open-stage]").click(),
  ]);
  await stage.waitForLoadState();
  await expect(stage.locator("[data-session]")).toHaveAttribute("data-steering", "true");
  await expect(stage.locator("[data-session]")).toHaveAttribute("data-sync", "hosted");
  expect(stage.url()).not.toContain(key);
  // The rehearsal this test opened ends here, so it does not linger for the next one.
  await desk.locator("[data-close]").click();
  await desk.locator("[data-close-untimed]").click();
  await close();
});
