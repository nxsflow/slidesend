import { readFileSync, writeFileSync } from "node:fs";

/** The line every generated document starts with, under its title. */
export const generatedNote =
  "Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.";

/** A generated document: its title, the note, an optional introduction, then the body. */
export function generatedDocument(title: string, body: string, intro?: string): string {
  return [`# ${title}`, "", generatedNote, "", ...(intro ? [intro, ""] : []), body].join("\n");
}

/**
 * Compares a committed document with what the code generates now, and with `UPDATE_DOCS` set
 * writes the generated one first. Returns the committed text, for the test to compare.
 */
export function committed(file: string, expected: string): string {
  if (process.env.UPDATE_DOCS) writeFileSync(file, expected);
  return readFileSync(file, "utf8");
}
