import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { coreMessages, messageKeys } from "../packages/core/src/index";

/** The reference of core's UI strings, generated from the catalog (spec §6.5, §15). */
function messageReference(): string {
  const english: Record<string, string> = coreMessages.en;
  const rows = messageKeys(coreMessages).map((key) => `| \`${key}\` | ${english[key]} |`);
  return ["| Key | English |", "|---|---|", ...rows, ""].join("\n");
}

it("keeps packages/core/docs/messages.md in step with the catalog", () => {
  const file = join(import.meta.dirname, "..", "packages", "core", "docs", "messages.md");
  const expected = `# UI strings

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

A talk overrides any of these with \`messages\` in \`presentation.config.ts\`; an override of a key
that no installed package has is a validation error. Plugins ship their own keys the same way.

${messageReference()}`;
  if (process.env.UPDATE_DOCS) writeFileSync(file, expected);
  expect(readFileSync(file, "utf8")).toBe(expected);
});
