import { expect, test } from "@playwright/test";

test("the phone address loads the example talk without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How does gravity work?" })).toBeVisible();
  expect(errors).toEqual([]);
});
