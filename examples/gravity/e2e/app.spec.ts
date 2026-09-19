import { expect, test } from "@playwright/test";

test("the example talk starts and resolves every workspace package", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "How does gravity work?" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Slidesend packages" }).getByRole("listitem"),
  ).toHaveText(["@slidesend/core", "@slidesend/basics", "@slidesend/aws", "@slidesend/agent"]);
  expect(errors).toEqual([]);
});
