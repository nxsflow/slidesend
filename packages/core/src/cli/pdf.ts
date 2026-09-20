/**
 * Printing to PDF, with the talk project's own Playwright (spec §4).
 *
 * It prints the LIVE views — `/print` and `/storyboard` — so the PDF carries real text that can
 * be searched, copied and read aloud. Nothing here takes a screenshot.
 *
 * Three guards, each of which caught a silent failure in the tool this was ported from:
 *
 * - **Wait for the fonts.** Without `document.fonts.ready` Chromium prints the fallback font,
 *   and on paper that is permanent.
 * - **Measure the overflow before printing.** A slide taller than its sheet is cut off silently;
 *   the page numbers are reported instead.
 * - **Count the pages of the written file.** A broken page-break rule turns a whole talk into a
 *   handful of sheets, and the file looks fine until someone reads it.
 */
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type PdfJob, pageCountOf, pageSizeOf } from "../print/pdf";
import type { PdfResult } from "./commands";

/** How long a view gets to settle after its first page appeared, for steps that build up. */
const settleMs = 1200;

export interface Chromium {
  launch(options?: { headless?: boolean }): Promise<{
    newPage(): Promise<PlaywrightPage>;
    close(): Promise<void>;
  }>;
}

export interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  setViewportSize?(size: { width: number; height: number }): Promise<void>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  pdf(options: Record<string, unknown>): Promise<void>;
  on(event: string, handler: (error: Error) => void): void;
}

/** Loads Playwright as the talk project resolves it; the tool does not ship a browser. */
export async function chromiumOf(projectRoot: string): Promise<Chromium> {
  const require = createRequire(join(projectRoot, "package.json"));
  let resolved: string;
  try {
    resolved = require.resolve("playwright");
  } catch {
    try {
      resolved = require.resolve("@playwright/test");
    } catch {
      throw new Error(
        "slidesend pdf needs Playwright in the talk project: npm install -D playwright",
      );
    }
  }
  // Playwright is CommonJS: imported by file path, its named exports may arrive only under
  // `default`, so both shapes are accepted rather than one being assumed.
  const module = (await import(pathToFileURL(resolved).href)) as {
    chromium?: Chromium;
    default?: { chromium?: Chromium };
  };
  const chromium = module.chromium ?? module.default?.chromium;
  if (!chromium) throw new Error("Playwright is installed but exports no chromium.");
  return chromium;
}

/** Writes every job and reports what the written files turned out to be. */
export async function writePdfs(
  projectRoot: string,
  baseUrl: string,
  jobs: readonly PdfJob[],
): Promise<PdfResult[]> {
  const chromium = await chromiumOf(projectRoot);
  const browser = await chromium.launch({ headless: true });
  const results: PdfResult[] = [];
  try {
    for (const job of jobs) {
      const page = await browser.newPage();
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(String(error)));
      await page.goto(`${baseUrl}${job.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector(job.ready, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(settleMs);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll("[data-print-page], [data-storyboard-row]")]
          .map((element, index) =>
            element.scrollHeight > element.clientHeight + 2 ? index + 1 : 0,
          )
          .filter((position) => position > 0),
      );
      const file = isAbsolute(job.file) ? job.file : join(projectRoot, job.file);
      await mkdir(dirname(file), { recursive: true });
      await page.pdf({
        path: file,
        printBackground: true,
        ...pageSizeOf(job),
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      if (failures.length > 0) throw new Error(`${job.path} logged an error: ${failures[0]}`);
      results.push({ job, pages: pageCountOf(await readFile(file)), overflowing });
    }
  } finally {
    await browser.close();
  }
  return results;
}
