import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { tokenReferenceTable } from "../packages/core/src/index";

// The token list is the design contract (spec §7); its reference is generated from the code.
it("keeps packages/core/docs/tokens.md in step with the token list", () => {
  const file = join(import.meta.dirname, "..", "packages", "core", "docs", "tokens.md");
  const expected = `# Design tokens\n\nGenerated from the code; run the tests with UPDATE_DOCS=1 to refresh.\n\n${tokenReferenceTable()}`;
  if (process.env.UPDATE_DOCS) writeFileSync(file, expected);
  expect(readFileSync(file, "utf8")).toBe(expected);
});
