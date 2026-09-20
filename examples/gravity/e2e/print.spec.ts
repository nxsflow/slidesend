import { expect, test } from "@playwright/test";
import { localPort } from "../playwright.config";

const base = `http://localhost:${localPort}`;

// Paper is where a talk stops being live: what it shows has to stand on its own.
test("the print view prints a page per printed step, and what the room made true is replaced", async ({
  page,
}) => {
  await page.goto(`${base}/print`);
  // The cover, plus every step the deck either ends on or says something about printing.
  await expect(page.locator("[data-print-page]")).toHaveCount(9);
  // The cover says which talk this stack is.
  await expect(page.locator("[data-cover] h1")).toHaveText("How does gravity work?");
  await expect(page.locator("[data-cover]")).toContainText("4 slides · 21 steps");

  const pages = page.locator("[data-print-page]:not([data-cover])");
  await expect(pages).toHaveCount(8);
  await expect(pages.nth(0)).toHaveAttribute("data-slide-id", "why");
  // The QR step prints because its rule replaces it — with the question it stood for.
  await expect(pages.nth(0)).toHaveAttribute("data-step", "2");
  await expect(pages.nth(0).getByText("Hammer or feather")).toBeVisible();
  await expect(pages.nth(0).locator("[data-print-text]")).toContainText(
    "answered this on their phones",
  );
  // The hero slide's own last page is the one it ends on, not the title step it opened with.
  await expect(pages.nth(1)).toHaveAttribute("data-step", "3");

  const last = page.locator('[data-print-page][data-slide-id="together"]').last();
  await expect(last).toHaveAttribute("data-step", "8");
});

test("the storyboard is the whole talk on one page, with the notes beside each slide", async ({
  page,
}) => {
  await page.goto(`${base}/storyboard`);
  await expect(page.locator("[data-storyboard-row]")).toHaveCount(4);
  const first = page.locator('[data-storyboard-row][data-slide-id="why"]');
  await expect(first.locator("h2")).toContainText("How does gravity work?");
  await expect(first).toContainText("4 step(s)");
  await expect(first.locator("[data-cue]")).toHaveText("Wait for phones");
  await expect(first.locator("[data-note]").first()).toHaveText("Welcome the class.");
  // Every slide shows its own rendering, not a placeholder.
  await expect(page.locator("[data-storyboard-row] [data-slide-id]")).toHaveCount(4);
});
