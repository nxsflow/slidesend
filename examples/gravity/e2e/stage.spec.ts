import { expect, type Page, test } from "@playwright/test";

/** The six formats of the original stage test. */
const viewports: [number, number, string][] = [
  [1512, 982, 'MacBook 14"'],
  [1920, 1080, "Full HD"],
  [1440, 900, "MacBook Air"],
  [2560, 1440, "WQHD"],
  [1280, 1024, "5:4 projector"],
  [3840, 1080, "very wide"],
];

const current = (page: Page) => page.locator("[data-slide-id][data-presence]:not([aria-hidden])");

for (const [width, height, name] of viewports) {
  test(`the stage is complete and centered: ${name} ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/stage/local");
    const stage = page.locator("[data-stage]");
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    if (!box) throw new Error("no stage");
    const left = box.x;
    const right = width - (box.x + box.width);
    const top = box.y;
    const bottom = height - (box.y + box.height);
    expect(Math.min(left, right, top, bottom)).toBeGreaterThanOrEqual(-1);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  });
}

test("the example talk renders on /stage/local and steers with the keyboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/stage/local");
  await expect(page.getByRole("heading", { name: "How does gravity work?" })).toBeVisible();
  await expect(current(page)).toHaveAttribute("data-slide-id", "intro-1");

  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toHaveAttribute("data-slide-id", "everyday");
  await expect(current(page)).toHaveAttribute("data-step", "0");
  await page.keyboard.press("PageDown");
  await page.keyboard.press(" ");
  await expect(current(page)).toHaveAttribute("data-step", "2");
  await expect(page.locator("[data-point='2']")).toHaveCSS("opacity", "1");

  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toHaveAttribute("data-slide-id", "falling-1");
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveAttribute("data-slide-id", "everyday");
  await expect(current(page)).toHaveAttribute("data-step", "2");
  await expect(current(page)).toHaveAttribute("data-presence", "present");
  expect(errors).toEqual([]);
});

test("keeps the leaving slide mounted while the next one enters", async ({ page }) => {
  await page.goto("/stage/local");
  await expect(current(page)).toHaveAttribute("data-presence", "present");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-slide-id="intro-1"][data-presence="leaving"]')).toBeAttached();
  await expect(page.locator('[data-slide-id="everyday"][data-presence="entering"]')).toBeAttached();
  await expect(page.locator('[data-slide-id="intro-1"]')).not.toBeAttached();
  await expect(current(page)).toHaveAttribute("data-presence", "present");
});

test("opens a deep link to a slide and step", async ({ page }) => {
  await page.goto("/stage/local?slide=everyday&step=2");
  await expect(current(page)).toHaveAttribute("data-slide-id", "everyday");
  await expect(current(page)).toHaveAttribute("data-step", "1");
});
