import { expect, test } from "@playwright/test";

test("the phone address is idle in local mode, where no audience can join", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("[data-phone]")).toHaveAttribute("data-page", "idle");
  await expect(page.getByText("Nothing is happening right now.")).toBeVisible();
  await expect(page.locator("[data-phone]")).not.toHaveAttribute("data-hosted", "true");
  expect(errors).toEqual([]);
});
