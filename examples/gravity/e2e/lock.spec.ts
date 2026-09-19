import { expect, type Page, test } from "@playwright/test";
import { hostedPort, hostedSecret } from "../playwright.config";

const base = `http://localhost:${hostedPort}`;
const current = (page: Page) => page.locator("[data-slide-id][data-presence]:not([aria-hidden])");
const position = async (page: Page) => {
  const layer = current(page);
  return `${await layer.getAttribute("data-slide-id")}/${await layer.getAttribute("data-step")}`;
};
const setVisible = (page: Page, visible: boolean) =>
  page.evaluate(
    (state) => {
      Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      if (state === "visible") window.dispatchEvent(new Event("online"));
    },
    visible ? "visible" : "hidden",
  );

// The original sperr-test: a phone is locked, the connection drops, the speaker moves on, and
// when the phone comes back it must follow the talk again without anyone doing anything.
test("a locked phone catches up with the talk when it returns", async ({ browser, request }) => {
  const call = async (method: string, args: unknown[]) => {
    const response = await request.post(`${base}/__slidesend/call`, { data: { method, args } });
    const body = await response.json();
    if (!body.ok) throw new Error(body.error.message);
    return body.result;
  };
  // A rehearsal, so that repeated and parallel runs never meet the one-open-live-session rule.
  const session = await call("sessionCreate", [
    hostedSecret,
    { kind: "rehearsal", name: "Lock test" },
  ]);
  await call("sessionOpen", [hostedSecret, session.id]);

  const stage = await (await browser.newContext()).newPage();
  const phoneContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await phoneContext.newPage();
  const errors: string[] = [];
  for (const page of [stage, phone]) page.on("pageerror", (error) => errors.push(error.message));

  await stage.goto(`${base}/stage/${session.id}#key=${hostedSecret}`);
  await phone.goto(`${base}/stage/${session.id}`);
  await expect(stage.locator("[data-steering]")).toHaveAttribute("data-sync", "hosted");
  await expect(phone.locator("[data-session]")).not.toHaveAttribute("data-steering");
  await expect(phone.locator("[data-session]")).toHaveAttribute("data-connected", "true");
  expect(stage.url()).not.toContain(hostedSecret);

  for (let press = 0; press < 2; press++) await stage.keyboard.press("ArrowRight");
  await expect.poll(() => position(phone)).toBe(await position(stage));

  // Lock: offline first (the connection dies), then the page goes to the background.
  await phoneContext.setOffline(true);
  // An open event stream survives the browser's offline switch; cut it as the network would.
  await request.post(`${base}/__slidesend/drop`);
  await setVisible(phone, false);
  const beforeLock = await position(phone);
  for (let press = 0; press < 2; press++) await stage.keyboard.press("ArrowRight");
  await expect.poll(() => position(stage)).not.toBe(beforeLock);
  const whileLocked = await position(stage);
  // The lock must bite: while locked, the phone has missed the moves.
  await phone.waitForTimeout(1000);
  expect(await position(phone)).toBe(beforeLock);

  // Unlock.
  await phoneContext.setOffline(false);
  await setVisible(phone, true);
  await expect.poll(() => position(phone), { timeout: 10_000 }).toBe(whileLocked);
  await expect(phone.locator("[data-session]")).toHaveAttribute("data-connected", "true");

  // And it keeps following.
  await stage.keyboard.press("ArrowRight");
  await expect.poll(() => position(phone)).toBe(await position(stage));
  expect(errors).toEqual([]);
  await call("sessionClose", [hostedSecret, session.id]);
});
