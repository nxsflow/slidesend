import { expect, type Locator, test } from "@playwright/test";
import { hostedPort, hostedSecret } from "../playwright.config";

const base = `http://localhost:${hostedPort}`;
const key = hostedSecret;

const call = async (method: string, args: unknown[]) => {
  const response = await fetch(`${base}/__slidesend/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, args }),
  });
  const body = (await response.json()) as { ok: boolean; result?: unknown };
  return body.result as { id: string; joinToken: string };
};

// Desk, stage and phone in ONE browser on the dev bridge (GH #50). A browser allows six HTTP/1.1
// connections per host; with an event stream per subscription they ran out a few steps in, the
// stage stopped following and the desk never saw it.
test("desk, stage and phone in one browser stay on the same step", async ({ browser }) => {
  const session = await call("sessionCreate", [
    key,
    { kind: "rehearsal", name: `Bridge ${Date.now()}` },
  ]);
  await call("sessionOpen", [key, session.id]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await context.newPage();
  await desk.goto(`${base}/desk#key=${key}`);
  await desk.locator("[data-history] summary").click();
  await desk.locator(`[data-session="${session.id}"] [data-present-session]`).click();
  const [stage] = await Promise.all([
    context.waitForEvent("page"),
    desk.locator("[data-present] [data-open-stage]").click(),
  ]);
  const phone = await context.newPage();
  await phone.goto(`${base}/r/${session.joinToken}`);

  const shown = "[data-slide-id][data-presence]:not([aria-hidden])";
  const onStage = stage.locator(shown);
  const position = async (slide: Locator) =>
    `${await slide.getAttribute("data-slide-id")}/${await slide.getAttribute("data-step")}`;
  await desk.locator("[data-present]").click();
  for (let step = 2; step <= 10; step++) {
    await desk.keyboard.press("ArrowRight");
    await expect(desk.locator("[data-position]")).toContainText(`${step} / `);
    // The stage shows what the desk's preview of the stage shows, within moments, not a pulse
    // later.
    const expected = await position(desk.locator("[data-preview]").first().locator(shown));
    await expect.poll(() => position(onStage), { timeout: 1000 }).toBe(expected);
    if (step === 3) await expect(phone.locator('[data-activity="guess"]')).toBeVisible();
  }
  await expect(desk.locator("[data-status]")).toContainText("1 stage(s) · 1 phone(s)", {
    timeout: 10_000,
  });
  await context.close();
});
