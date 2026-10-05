import { type Browser, expect, type Page, test } from "@playwright/test";
import { blocksPort, blocksSecret } from "../playwright.config";

const base = `http://localhost:${blocksPort}`;

const openPhone = async (browser: Browser, url: string): Promise<Page> => {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(url);
  return page;
};

// Two phones answer the inline poll while the stage counts along, and a phone that joins late
// still gets the question that asked to be kept (spec §6.5).
test("two phones answer a poll and the matrix on the stage counts them", async ({
  browser,
  request,
}) => {
  const key = blocksSecret;
  const rpc = async (method: string, params: unknown[]) => {
    const response = await request.post(`${base}/aws-blocks/api`, {
      data: { jsonrpc: "2.0", method: `slidesend.${method}`, params, id: 1 },
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
  const session = await rpc("sessionCreate", [key, { kind: "rehearsal", name: "Poll test" }]);
  await rpc("sessionOpen", [key, session.id]);

  // The stage shows the matrix of the poll it asks itself.
  const stage = await (await browser.newContext()).newPage();
  await stage.goto(`${base}/stage/${session.id}?slide=falling-1&step=2#key=${key}`);
  const matrix = stage.locator('[data-block="pollMatrix"]');
  await expect(matrix).toHaveAttribute("data-answered", "0");
  // Each axis says what it counts: the first question beside the rows, the second above.
  await expect(matrix.locator('[data-axis="y"]')).toHaveText("Heavy things fall faster");
  await expect(matrix.locator('[data-axis="x"]')).toHaveText("The air changes it");

  const answer = async (phone: Page, weight: string, air: string) => {
    await expect(phone.locator('[data-activity="mood"]')).toBeVisible();
    await phone
      .locator('[data-activity="mood"] fieldset', { hasText: "heavy" })
      .getByRole("button", { name: weight })
      .click();
    await phone
      .locator('[data-activity="mood"] fieldset', { hasText: "air" })
      .getByRole("button", { name: air })
      .click();
  };

  const first = await openPhone(browser, `${base}/r/${session.joinToken}`);
  await answer(first, "Yes", "No");
  await expect(matrix).toHaveAttribute("data-answered", "1");
  await expect(matrix.locator('[data-cell="yes/no"]')).toHaveText("1");

  const second = await openPhone(browser, `${base}/r/${session.joinToken}`);
  await answer(second, "No", "Yes");
  await expect(matrix).toHaveAttribute("data-answered", "2");
  await expect(matrix.locator('[data-cell="no/yes"]')).toHaveText("1");

  // A correction moves the participant, it does not add one.
  await answer(first, "No", "Yes");
  await expect(matrix.locator('[data-cell="no/yes"]')).toHaveText("2");
  await expect(matrix).toHaveAttribute("data-answered", "2");

  // A phone that joins now sees the running poll and the question kept from earlier.
  const late = await openPhone(browser, `${base}/r/${session.joinToken}`);
  await expect(late.locator('[data-activity="mood"]')).toBeVisible();
  await expect(late.locator('[data-activity="guess"][data-kept]')).toBeVisible();

  // The split poll: asked on one panel, shown on the next.
  await stage.goto(`${base}/stage/${session.id}?slide=together&step=8#key=${key}`);
  await expect(first.locator('[data-activity="after"]')).toBeVisible();
  await first.getByRole("button", { name: "That the Moon is falling" }).click();
  await stage.goto(`${base}/stage/${session.id}?slide=together&step=9#key=${key}`);
  await expect(stage.locator('[data-block="pollList"] [data-option="moon"]')).toHaveAttribute(
    "data-count",
    "1",
  );
  await rpc("sessionClose", [key, session.id]);
});
