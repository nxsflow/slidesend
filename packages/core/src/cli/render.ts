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
    // What the page itself said. A render pass that fails because the app did not start is
    // otherwise a timeout with no cause, which is the worst thing to read in a build log.
    const said: string[] = [];
    page.on("pageerror", ((error: Error) => said.push(String(error))) as never);
    page.on("console", ((message: { type(): string; text(): string }) => {
      if (message.type() === "error") said.push(message.text());
    }) as never);
    // The stage is a fixed surface that is scaled to its room, so one room is enough: what
    // fits here fits everywhere (the rooms themselves are checked by `stageChecks`).
    await page.setViewportSize?.({ width: 1920, height: 1080 });

    /**
     * Opens one step and measures it, twice if it has to.
     *
     * On its first run a dev server optimizes the dependencies it just discovered and RELOADS
     * the page underneath — which destroys the context a measurement is running in. That
     * happens exactly once, on a cold machine, which is to say: in CI.
     */
    const visit = async (step: StepAddress) => {
      const url = `${baseUrl}${stepLink(step.slideId, step.step)}`;
      let last: unknown;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await page.goto(url, { waitUntil: "networkidle" });
          await page.waitForSelector("[data-stage]", { timeout: 30_000 });
          await page.evaluate(() => document.fonts.ready);
          // Templates animate; a measurement mid-transition would report a moving panel.
          await page.waitForTimeout(400);
          return await page.evaluate(measureOverflow);
        } catch (error) {
          last = error;
          await page.waitForTimeout(1000);
        }
      }
      throw new Error(
        [
          `Could not measure slide "${step.slideId}" step ${step.step + 1}: ${
            last instanceof Error ? last.message : String(last)
          }`,
          ...said.slice(0, 3).map((line) => `  the page said: ${line.slice(0, 300)}`),
        ].join("\n"),
      );
    };

    // A warm-up: the optimizer's reload happens here rather than in the middle of a
    // measurement, and the extra load afterwards proves the page is stable before anything is
    // believed.
    if (steps[0]) {
      await visit(steps[0]);
      await page.waitForTimeout(500);
      await visit(steps[0]);
    }
    for (const step of steps) {
      const measured = await visit(step);
      if (overflows(measured)) findings.push({ ...step, ...measured });
    }
  } finally {
    await browser.close();
  }
  return findings;
}
