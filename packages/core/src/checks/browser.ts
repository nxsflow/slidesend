/**
 * The browser checks every talk gets for free (spec §16).
 *
 * A talk project writes three lines and inherits the checks this tool was built with: that the
 * stage is complete and centred in every room it will meet, that nothing overflows it, and that
 * a locked phone catches up by itself. They are the checks whose absence costs a talk, and the
 * ones nobody writes for their own deck.
 *
 * This module imports `@playwright/test`, so it is its own entry (`@slidesend/core/checks`) and
 * belongs in a spec file — never in a bundle.
 */
import { expect, type Page, test } from "@playwright/test";
import type { Presentation } from "../deck/presentation";
import { measureOverflow, overflowMessage, overflows, stepLink } from "./overflow";

/** The rooms a talk is checked against: laptops, projectors and one very wide screen. */
export const defaultViewports: readonly [number, number, string][] = [
  [1512, 982, 'MacBook 14"'],
  [1920, 1080, "Full HD"],
  [1440, 900, "MacBook Air"],
  [2560, 1440, "WQHD"],
  [1280, 1024, "5:4 projector"],
  [3840, 1080, "very wide"],
];

/** The slide layer that is on screen right now. */
export const currentSlide = (page: Page) =>
  page.locator("[data-slide-id][data-presence]:not([aria-hidden])");

/** Waits until nothing moves any more: transitions have settled and the step is present. */
export async function settled(page: Page): Promise<void> {
  await expect(currentSlide(page)).toHaveAttribute("data-presence", "present");
  await page.waitForTimeout(350);
}

/** Options shared by the checks. */
export interface CheckOptions {
  /** The stage's address; the default uses the config's `baseURL` and local mode. */
  stagePath?: string;
  /** The rooms to check; defaults to `defaultViewports`. */
  viewports?: readonly [number, number, string][];
}

/**
 * The stage is complete and centred in every room: the whole 16:9 surface is on screen, with
 * equal margins, and nothing is cut off at an edge.
 */
export function stageChecks(options: CheckOptions = {}): void {
  const path = options.stagePath ?? "/stage/local";
  for (const [width, height, name] of options.viewports ?? defaultViewports) {
    test(`the stage is complete and centered: ${name} ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      const stage = page.locator("[data-stage]");
      await expect(stage).toBeVisible();
      const box = await stage.boundingBox();
      if (!box) throw new Error("The stage has no box.");
      const left = box.x;
      const right = width - (box.x + box.width);
      const top = box.y;
      const bottom = height - (box.y + box.height);
      // Nothing off-screen, and the same air on both sides: a stage that sits 30 px left of
      // centre looks like a mistake from the back of the room.
      expect(Math.min(left, right, top, bottom)).toBeGreaterThanOrEqual(-1);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
      expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
    });
  }
}

/**
 * Nothing overflows the stage, at any step.
 *
 * The stage clips, so a list one item too long loses its last line in silence — and nobody
 * notices until they are standing in front of it.
 *
 * ONE room, not six: the stage is a fixed 1920 × 1080 surface that is scaled to whatever screen
 * it meets, so what fits in one room fits in all of them. The rooms matter for `stageChecks`,
 * which is about the scaling itself; repeating this walk six times would only cost time.
 */
export function overflowChecks(presentation: Presentation): void {
  test("no content overflows the stage", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const problems: string[] = [];
    for (const step of presentation.steps) {
      await page.goto(stepLink(step.slideId, step.step));
      await settled(page);
      const finding = await page.evaluate(measureOverflow);
      if (overflows(finding)) {
        problems.push(overflowMessage({ slideId: step.slideId, step: step.step, ...finding }));
      }
    }
    expect(problems).toEqual([]);
  });
}

/** What the lock check needs from the talk: its own way to open and steer a session. */
export interface LockCheckOptions extends CheckOptions {
  /** Where stage and phone open their pages, e.g. the dev bridge's address. */
  baseUrl: string;
  /** Opens a session for this check and says how a stage may steer it. */
  open(): Promise<{
    /** The session's id. */
    id: string;
    /** The address of the steering stage, including whatever authorizes it. */
    stagePath: string;
    /** The address of a following window on the same session. */
    followerPath: string;
  }>;
  /** Closes it again. */
  close(sessionId: string): Promise<void>;
  /**
   * Cuts the server's open streams, the way a network does. A browser's offline switch does not
   * end an event stream that is already open, and without this the check cannot tell a phone
   * that caught up from one that was never cut off.
   */
  drop?(): Promise<void>;
}

/** Where a window stands: slide and step, as the follower must match it. */
async function position(page: Page): Promise<string> {
  const layer = currentSlide(page);
  return `${await layer.getAttribute("data-slide-id")}/${await layer.getAttribute("data-step")}`;
}

/**
 * A phone is locked, its connection drops, the speaker moves on, and when it comes back it has
 * to follow the talk again without anyone doing anything.
 *
 * This is the check that pays for the whole sync design, and the one a talk author would never
 * think to write: on a desk, where the phone is never put away, everything always works. It
 * also asserts that the lock BIT — a phone that never fell behind proves nothing about catching
 * up.
 */
export function lockCheck(options: LockCheckOptions): void {
  const { baseUrl, open, close, drop } = options;
  test("a locked phone catches up with the talk when it returns", async ({ browser }) => {
    const session = await open();
    const stage = await (await browser.newContext()).newPage();
    const phoneContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const phone = await phoneContext.newPage();
    const errors: string[] = [];
    for (const page of [stage, phone]) {
      page.on("pageerror", (error) => errors.push(error.message));
    }

    await stage.goto(`${baseUrl}${session.stagePath}`);
    await phone.goto(`${baseUrl}${session.followerPath}`);
    await expect(stage.locator("[data-steering]")).toHaveAttribute("data-sync", "hosted");
    await expect(phone.locator("[data-session]")).toHaveAttribute("data-connected", "true");

    for (let press = 0; press < 2; press++) await stage.keyboard.press("ArrowRight");
    await expect.poll(() => position(phone)).toBe(await position(stage));

    // Into the pocket: offline first, as the connection dies, then the page goes away.
    await phoneContext.setOffline(true);
    await drop?.();
    await setVisible(phone, false);
    const beforeLock = await position(phone);

    for (let press = 0; press < 2; press++) await stage.keyboard.press("ArrowRight");
    await expect.poll(() => position(stage)).not.toBe(beforeLock);
    const whileLocked = await position(stage);
    await phone.waitForTimeout(1000);
    expect(await position(phone)).toBe(beforeLock);

    // Out again.
    await phoneContext.setOffline(false);
    await setVisible(phone, true);
    await expect.poll(() => position(phone), { timeout: 20_000 }).toBe(whileLocked);
    await expect(phone.locator("[data-session]")).toHaveAttribute("data-connected", "true");

    // And it keeps following, rather than having caught up once.
    await stage.keyboard.press("ArrowRight");
    await expect.poll(() => position(phone)).toBe(await position(stage));
    expect(errors).toEqual([]);
    await close(session.id);
    await phoneContext.close();
  });
}

/** Tells the page it was put away or taken out again, the way a phone's browser does. */
export async function setVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate(
    (state) => {
      Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      if (state === "visible") window.dispatchEvent(new Event("online"));
    },
    visible ? "visible" : "hidden",
  );
}
