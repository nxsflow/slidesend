/**
 * The render pass of `slidesend check` (spec §5.2): every step on the stage, measured.
 *
 * It runs the same measuring function the browser checks use, so a talk cannot pass one and
 * fail the other. The browser is the talk project's Playwright — the tool ships none.
 */
import type { OverflowFinding } from "../checks/overflow";
import { measureOverflow, overflows, stepLink } from "../checks/overflow";
import type { StepAddress } from "./commands";
import { chromiumOf } from "./pdf";

/** Opens every step and returns what does not fit. */
export async function renderCheck(
  projectRoot: string,
  baseUrl: string,
  steps: readonly StepAddress[],
): Promise<OverflowFinding[]> {
  const chromium = await chromiumOf(projectRoot);
  const browser = await chromium.launch({ headless: true });
  const findings: OverflowFinding[] = [];
  try {
    const page = await browser.newPage();
    // The stage is a fixed surface that is scaled to its room, so one room is enough: what
    // fits here fits everywhere (the rooms themselves are checked by `stageChecks`).
    await page.setViewportSize?.({ width: 1920, height: 1080 });
    for (const step of steps) {
      await page.goto(`${baseUrl}${stepLink(step.slideId, step.step)}`, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-stage]", { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      // Templates animate; a measurement taken mid-transition would report a moving panel.
      await page.waitForTimeout(400);
      const measured = await page.evaluate(measureOverflow);
      if (overflows(measured)) findings.push({ ...step, ...measured });
    }
  } finally {
    await browser.close();
  }
  return findings;
}
