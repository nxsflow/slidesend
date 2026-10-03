import { currentSlide, stageChecks } from "@nxsflow/slidesend-core/checks";
import { expect, type Page, test } from "@playwright/test";

const current = (page: Page) => currentSlide(page);

// The stage check comes from the tool, in every room a talk may meet (spec §16).
stageChecks();

test("the example talk renders on /stage/local and steers with the keyboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/stage/local");
  await expect(page.getByRole("heading", { name: "How does gravity work?" })).toBeVisible();
  await expect(current(page)).toHaveAttribute("data-slide-id", "why");

  for (let press = 0; press < 3; press++) await page.keyboard.press("ArrowRight");
  await expect(current(page)).toHaveAttribute("data-step", "3");
  await page.keyboard.press("PageDown");
  await expect(current(page)).toHaveAttribute("data-slide-id", "observations");
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveAttribute("data-slide-id", "why");
  await expect(current(page)).toHaveAttribute("data-step", "3");
  await expect(current(page)).toHaveAttribute("data-presence", "present");

  // The last slide builds up: a block with its own steps.
  await page.goto("/stage/local?slide=together&step=6");
  await expect(current(page)).toHaveAttribute("data-step", "5");
  await expect(page.locator("[data-point='1']")).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("keeps the leaving slide mounted while the next one enters", async ({ page }) => {
  await page.goto("/stage/local?slide=why&step=4");
  await expect(current(page)).toHaveAttribute("data-presence", "present");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-slide-id="why"][data-presence="leaving"]')).toBeAttached();
  await expect(
    page.locator('[data-slide-id="observations"][data-presence="entering"]'),
  ).toBeAttached();
  await expect(page.locator('[data-slide-id="why"]')).not.toBeAttached();
  await expect(current(page)).toHaveAttribute("data-presence", "present");
});

test("opens a deep link to a slide and step", async ({ page }) => {
  await page.goto("/stage/local?slide=observations&step=2");
  await expect(current(page)).toHaveAttribute("data-slide-id", "observations");
  await expect(current(page)).toHaveAttribute("data-step", "1");
});
