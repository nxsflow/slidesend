import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { documents, embedSnippets, region, repositoryRoot } from "./doc-snippets";

describe("snippets embedded in the docs", () => {
  for (const file of documents()) {
    it(`are current in ${relative(repositoryRoot, file)}`, () => {
      const document = readFileSync(file, "utf8");
      const expected = embedSnippets(document);
      if (process.env.UPDATE_DOCS) writeFileSync(file, expected);
      expect(document).toBe(expected);
    });
  }

  it("cuts a region out of its source and drops the common indentation", () => {
    const source = ["a", "  // snippet: x", "  one", "    two", "  // end snippet", "b"].join("\n");
    expect(region(source, "x")).toBe("one\n  two");
    expect(() => region(source, "y")).toThrow('no snippet "y"');
  });
});
