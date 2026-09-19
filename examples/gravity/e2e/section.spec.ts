import { expect, type Page, test } from "@playwright/test";
import { viewports } from "./viewports";

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).first().boundingBox();
  if (!found) throw new Error(`no ${selector}`);
  return found;
};
const centerY = (rect: { y: number; height: number }) => rect.y + rect.height / 2;
const settled = (page: Page) => page.waitForTimeout(1000);

test("the hero title starts centered, travels up, and the panels move like a carousel", async ({
  page,
}) => {
  await page.goto("/stage/local");
  const stage = await box(page, "[data-stage]");
  await settled(page);

  // Hero: the title sits in the middle of the stage, no panels yet.
  const hero = await box(page, "[data-section-title]");
  expect(Math.abs(centerY(hero) - centerY(stage))).toBeLessThan(stage.height * 0.1);
  await expect(page.locator("[data-carousel]")).toHaveCount(0);

  // Travel: the title moves up and the first panel shows.
  await page.keyboard.press("ArrowRight");
  await settled(page);
  const heading = await box(page, "[data-section-title]");
  expect(heading.y - stage.y).toBeLessThan(stage.height * 0.2);
  await expect(page.locator("[data-panel='0']")).toHaveAttribute("data-active", "true");

  // Carousel forward: the second panel slides in from the right, the first leaves to the left.
  const first = await box(page, "[data-panel='0']");
  await page.keyboard.press("ArrowRight");
  await settled(page);
  await expect(page.locator("[data-panel='1']")).toHaveAttribute("data-active", "true");
  await expect(page.locator("[data-panel='0']")).toHaveAttribute("aria-hidden", "true");
  const second = await box(page, "[data-panel='1']");
  expect(Math.abs(second.x - first.x)).toBeLessThan(2);

  // Carousel backward, and back to the hero.
  await page.keyboard.press("ArrowLeft");
  await settled(page);
  await expect(page.locator("[data-panel='0']")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowLeft");
  await settled(page);
  const again = await box(page, "[data-section-title]");
  expect(Math.abs(centerY(again) - centerY(stage))).toBeLessThan(stage.height * 0.1);
});

test("a block with its own steps builds up in place", async ({ page }) => {
  await page.goto("/stage/local?slide=together&step=1");
  await settled(page);
  const before = await box(page, "[data-panel='0']");
  await expect(page.locator("[data-item='1'][data-shown]")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await settled(page);
  await expect(page.locator("[data-item='1'][data-shown]")).toHaveCount(1);
  const after = await box(page, "[data-panel='0']");
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  await expect(page.locator("[data-panel='0']")).toHaveAttribute("data-active", "true");
});

for (const [width, height, name] of viewports) {
  test(`no content overflows the stage: ${name} ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [slide, step] of [
      // Steps count from 1 in a deep link; "why" step 1 is the hero title.
      ["why", 2],
      ["why", 4],
      ["observations", 1],
      ["observations", 2],
      ["falling-1", 1],
      ["together", 6],
    ] as const) {
      await page.goto(`/stage/local?slide=${slide}&step=${step}`);
      await settled(page);
      const stage = await box(page, "[data-stage]");
      const panel = page.locator("[data-panel][data-active] > div > div").first();
      const content = await panel.boundingBox();
      if (!content) throw new Error("no active panel content");
      expect(content.x).toBeGreaterThanOrEqual(stage.x - 1);
      expect(content.y).toBeGreaterThanOrEqual(stage.y - 1);
      expect(content.x + content.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
      expect(content.y + content.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
    }
  });
}
