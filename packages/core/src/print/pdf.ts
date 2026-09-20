/**
 * What `slidesend pdf` writes, and how it knows the file is right (spec §4).
 *
 * The browser work itself lives in the CLI, because it needs the talk project's Playwright. What
 * is decided here can be decided without a browser: which documents are written, what they are
 * called, and — the part that caught a silent failure in the tool this was ported from — how
 * many pages the finished PDF really has.
 */
import type { Presentation } from "../deck/presentation";
import { printSteps } from "./rules";

/** One document to write. */
export interface PdfJob {
  /** The path of the view, appended to the dev server's address. */
  path: string;
  /** Where the file goes, relative to the project. */
  file: string;
  /** The selector that must exist before printing; it proves the view rendered. */
  ready: string;
  /** How many pages the document must have, when that is known in advance. */
  pages?: number;
  /** A4 landscape for slides, portrait for the storyboard. */
  landscape: boolean;
}

/** A file name from the talk's title: lowercase, dashes, nothing a shell has to quote. */
export function slugOf(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "talk";
}

/**
 * The two documents: the talk on paper, and the storyboard. The print job knows its page count
 * in advance — the cover plus one page per printed step — and that number is what the finished
 * file is held against.
 */
export function pdfJobs(presentation: Presentation, outDir = "dist"): PdfJob[] {
  const slug = slugOf(presentation.meta.title);
  return [
    {
      path: "/print",
      file: `${outDir}/${slug}.pdf`,
      ready: "[data-print-page]",
      pages: printSteps(presentation).length + 1,
      landscape: true,
    },
    {
      path: "/storyboard",
      file: `${outDir}/${slug}-storyboard.pdf`,
      ready: "[data-storyboard-row]",
      landscape: false,
    },
  ];
}

/**
 * How many pages a PDF has, read from the file itself.
 *
 * A PDF's page tree has inner nodes, and each one carries its own `/Count`. The FIRST match is
 * therefore often a subtree — in the tool this was ported from that read 8 where the document
 * had 62, and a correct build was rejected for weeks. The largest count is the root's.
 */
export function pageCountOf(pdf: Uint8Array | string): number {
  const text = typeof pdf === "string" ? pdf : Buffer.from(pdf).toString("latin1");
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
  return counts.length > 0 ? Math.max(...counts) : 0;
}

/** What a finished document is held against, in one sentence a build log can carry. */
export function pageCountProblem(job: PdfJob, actual: number): string | undefined {
  if (job.pages === undefined || job.pages === actual) return undefined;
  return `${job.file} has ${actual} page(s), but the talk prints ${job.pages}. Something is being lost.`;
}

/** The page size Chromium is told, in millimetres: A4, no margins of its own. */
export function pageSizeOf(job: PdfJob): { width: string; height: string } {
  // Passed explicitly rather than through `preferCSSPageSize`: an `@page` rule inside an
  // injected <style> is ignored at print time, and Chromium then picks a page of its own.
  return job.landscape ? { width: "297mm", height: "210mm" } : { width: "210mm", height: "297mm" };
}
