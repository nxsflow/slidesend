import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { blocksPort } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;

function controlSecret(): string {
  const settings = JSON.parse(readFileSync(join(".bb-data", "settings.json"), "utf8"));
  const entry = Object.entries(settings).find(([key]) => key.endsWith("-sd-control"));
  if (typeof entry?.[1] !== "string") throw new Error("no control secret in .bb-data");
  return entry[1];
}

test("a phone joins, answers, comes back after a reload and follows the talk", async ({
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
  const session = await rpc("sessionCreate", [key, { kind: "rehearsal", name: "Phone test" }]);
  await rpc("sessionOpen", [key, session.id]);

  const errors: string[] = [];
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await context.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  const stage = await (await browser.newContext()).newPage();

  // Before the first activity the phone waits on the start page.
  await phone.goto(`${base}/r/${session.joinToken}`);
  await expect(phone.locator("[data-phone]")).toHaveAttribute("data-page", "open");
  await expect(phone.locator('p[data-page="start"], div[data-page="start"]')).toBeVisible();

  // The speaker reaches the question; the phone shows it with its message.
  await stage.goto(`${base}/stage/${session.id}?slide=why&step=3#key=${key}`);
  await expect(phone.locator('[data-activity="guess"]')).toBeVisible();
  await expect(phone.locator("[data-activity-message]")).toHaveText(
    "The talk has just started — take a guess.",
  );

  // It answers, and sees its own answer again after a reload.
  await phone.getByLabel("What falls faster: a hammer or a feather?").fill("Both the same");
  await phone.getByRole("button", { name: "Send" }).click();
  await expect(phone.locator("[data-sent]")).toHaveText("Both the same");
  await phone.reload();
  await expect(phone.locator("[data-sent]")).toHaveText("Both the same");
  await expect(phone.getByLabel("What falls faster: a hammer or a feather?")).toHaveValue(
    "Both the same",
  );

  // The question stays while the talk moves on, because it asked to be kept.
  await stage.goto(`${base}/stage/${session.id}?slide=observations&step=1#key=${key}`);
  await expect(phone.locator('[data-activity="guess"][data-kept]')).toBeVisible();

  // On the slide it was kept until, it disappears, and the new question starts empty.
  await stage.goto(`${base}/stage/${session.id}?slide=together&step=1#key=${key}`);
  await expect(phone.locator('[data-activity="question"]')).toBeVisible();
  await expect(phone.locator('[data-activity="guess"]')).toHaveCount(0);
  await expect(phone.getByLabel("What would you still like to know?")).toHaveValue("");
  await expect(phone.locator("[data-sent]")).toHaveCount(0);

  // When the session closes, the phone says goodbye.
  await rpc("sessionClose", [key, session.id]);
  await expect(phone.locator("[data-phone]")).toHaveAttribute("data-page", "closed", {
    timeout: 30_000,
  });
  await expect(phone.getByText("Thanks for joining")).toBeVisible();
  expect(errors).toEqual([]);
});
