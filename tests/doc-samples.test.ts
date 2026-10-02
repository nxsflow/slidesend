import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { compileSamples } from "./doc-samples";
import { documents, repositoryRoot } from "./doc-snippets";

describe("samples in the docs", () => {
  it("compile against the packages", () => {
    const problems = compileSamples(
      documents().map((file) => ({
        name: relative(repositoryRoot, file),
        text: readFileSync(file, "utf8"),
      })),
    );
    expect(problems.map((p) => `${p.document}:${p.line}: ${p.message}`)).toEqual([]);
  }, 120_000);
});
