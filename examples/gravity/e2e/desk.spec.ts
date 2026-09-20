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

test("a wrong secret leaves the desk view only, and the right one takes control", async ({
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
  await desk.getByLabel("Control secret").fill("still wrong");
  await desk.getByRole("button", { name: "Take control" }).click();
  await expect(desk.locator("[data-wrong]")).toBeVisible();

  await desk.getByLabel("Control secret").fill(key);
  await desk.getByRole("button", { name: "Take control" }).click();
  await expect(desk.locator("[data-desk]")).toHaveAttribute("data-control", "true");
  await context.close();
});

test("creating, arming, opening and closing a session works from the desk", async ({ browser }) => {
  const key = blocksSecret;
  const first = await openDesk(browser, key, {
    label: "Lectern laptop",
    viewport: { width: 1280, height: 800 },
  });
  const desk = first.page;

  const name = `Desk test ${Date.now()}`;
  await desk.getByLabel("Name", { exact: true }).fill(name);
  await desk.getByLabel("Kind", { exact: true }).selectOption("rehearsal");
  await desk.getByRole("button", { name: "Create session" }).click();
  const session = desk.locator("li", { hasText: name });
  await expect(session).toBeVisible();
  await expect(session).toHaveAttribute("data-state", "draft");

  await session.locator("[data-open]").click();
  await expect(session).toHaveAttribute("data-state", "open");

  // The Join card shows this rehearsal's own address, and the deck card its plan.
  await expect(desk.locator("[data-join]")).toHaveAttribute("href", /\/r\/[0-9a-f]+$/);
  await expect(desk.getByText("4 slides, 22 steps.")).toBeVisible();

  // The desk is usable at 1280×800 without scrolling sideways.
  const overflow = await desk.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // A second desk is named in the warning, with its label.
  const other = await openDesk(browser, key, { label: "Back of the room" });
  await other.page.locator("li", { hasText: name }).getByRole("button", { name }).click();
  // Other checks may leave desks of their own running, so look for this one by its label.
  await expect(desk.getByText("Another desk is on this session: Back of the room.")).toBeVisible({
    timeout: 30_000,
  });

  // Closing a rehearsal asks whether it was a timed run before anything is closed (spec §13).
  await session.locator("[data-close]").click();
  await expect(session).toHaveAttribute("data-state", "open");
  await session.locator("[data-close-timed]").click();
  await expect(session).toHaveAttribute("data-state", "closed");
  await other.close();
  await first.close();
});

test("the desk opens the stage, already authorized and on the selected session", async ({
  browser,
}) => {
  const key = blocksSecret;
  const { page: desk, context, close } = await openDesk(browser, key);
  const name = `Stage from desk ${Date.now()}`;
  await desk.getByLabel("Name", { exact: true }).fill(name);
  await desk.getByLabel("Kind", { exact: true }).selectOption("rehearsal");
  await desk.getByRole("button", { name: "Create session" }).click();
  const session = desk.locator("li", { hasText: name });
  await session.locator("[data-open]").click();
  await session.getByRole("button", { name }).click();

  const [stage] = await Promise.all([
    context.waitForEvent("page"),
    desk.locator("[data-open-stage]").click(),
  ]);
  await stage.waitForLoadState();
  await expect(stage.locator("[data-session]")).toHaveAttribute("data-steering", "true");
  await expect(stage.locator("[data-session]")).toHaveAttribute("data-sync", "hosted");
  expect(stage.url()).not.toContain(key);
  await close();
});
