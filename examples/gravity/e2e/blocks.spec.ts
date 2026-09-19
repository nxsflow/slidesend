import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { blocksPort } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;
const position = (page: Page) =>
  page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>(
      "[data-slide-id][data-presence]:not([aria-hidden])",
    );
    return layer ? `${layer.dataset.slideId}/${layer.dataset.step}` : undefined;
  });

/** The control secret the Blocks mocks created for this project. */
function controlSecret(): string {
  const settings = JSON.parse(readFileSync(join(".bb-data", "settings.json"), "utf8"));
  const entry = Object.entries(settings).find(([key]) => key.endsWith("-sd-control"));
  if (typeof entry?.[1] !== "string") throw new Error("no control secret in .bb-data");
  return entry[1];
}

// `slidesend dev` with platform aws(): the example talk on the AWS Blocks dev server.
test("stage and two phones follow one session on the AWS Blocks dev server", async ({
  browser,
  request,
}) => {
  const key = controlSecret();
  const rpc = async (method: string, params: unknown[]) => {
    const response = await request.post(`${base}/aws-blocks/api`, {
      data: { jsonrpc: "2.0", method: `slidesend.${method}`, params, id: 1 },
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
  const session = await rpc("sessionCreate", [key, { kind: "rehearsal", name: "Blocks dev" }]);
  await rpc("sessionOpen", [key, session.id]);

  const errors: string[] = [];
  const open = async (url: string, mobile = false) => {
    const context = await browser.newContext(
      mobile ? { viewport: { width: 393, height: 852 }, isMobile: true } : {},
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    return page;
  };
  const stage = await open(`${base}/stage/${session.id}#key=${key}`);
  const phones = [
    await open(`${base}/stage/${session.id}`, true),
    await open(`${base}/stage/${session.id}`, true),
  ];
  await expect(stage.locator("[data-session]")).toHaveAttribute("data-sync", "hosted");
  for (const phone of phones) {
    await expect(phone.locator("[data-session]")).toHaveAttribute("data-connected", "true");
  }

  for (let press = 0; press < 3; press++) await stage.keyboard.press("ArrowRight");
  await expect.poll(() => position(stage)).toBe("why/3");
  for (const phone of phones) await expect.poll(() => position(phone)).toBe("why/3");
  expect((await rpc("cursorRead", [key, session.id])).step).toBe(3);

  const desk = await open(`${base}/desk#key=${key}`);
  await expect(desk.getByText("The desk view is not available yet.")).toBeVisible();
  expect(errors).toEqual([]);
  await rpc("sessionClose", [key, session.id]);
});
