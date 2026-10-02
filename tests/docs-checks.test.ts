import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { tokenReferenceTable } from "../packages/core/src/index";
import { brokenLinks } from "./doc-links";
import { compileSamples, samplesOf } from "./doc-samples";
import { documents, embedSnippets, repositoryRoot } from "./doc-snippets";
import { generatedDocument } from "./generated-docs";

// Each check of spec §15 must fail on a deliberately broken document, or a green run means
// nothing. The real docs are checked in doc-snippets, doc-samples, reference-docs and below.
const fixtures = join(repositoryRoot, "tests", "fixtures", "docs");
const fixture = (name: string) => readFileSync(join(fixtures, name), "utf8");

describe("the docs checks fail on broken fixtures", () => {
  it("1. an embedded snippet that differs from its source", () => {
    const document = fixture("stale-snippet.md");
    expect(embedSnippets(document)).not.toBe(document);
    expect(embedSnippets(document)).toContain('export const greeting = "hello";');
  });

  it("2. a sample that does not compile, at its line in the document", () => {
    const text = fixture("broken-sample.md");
    expect(samplesOf(text).map((sample) => sample.file ?? "fragment")).toEqual([
      "src/deck.ts",
      "src/main.ts",
      "fragment",
    ]);
    const problems = compileSamples([{ name: "broken-sample.md", text }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ document: "broken-sample.md", line: 14 });
    expect(problems[0]?.message).toMatch(
      /^TS2322: Type 'string' is not assignable to type 'number'/,
    );
  }, 120_000);

  it("3. a generated reference that no longer matches the code", () => {
    const expected = generatedDocument("Design tokens", tokenReferenceTable());
    expect(fixture("stale-reference.md")).not.toBe(expected);
  });

  it("4. a relative link to a missing file or heading", () => {
    expect(brokenLinks(join(fixtures, "broken-links.md"))).toEqual([
      "missing.md: no such file",
      "stale-snippet.md#no-such-heading: no such heading",
    ]);
  });
});

describe("links in the docs", () => {
  const files = [
    ...documents(),
    join(repositoryRoot, "examples", "gravity", "AGENTS.md"),
    join(repositoryRoot, "docs", "docs-tests.md"),
  ];
  for (const file of files) {
    it(`lead somewhere in ${relative(repositoryRoot, file)}`, () => {
      expect(brokenLinks(file)).toEqual([]);
    });
  }
});
