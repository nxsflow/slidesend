import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { externalImportsOf } from "./entry-separation";

const root = join(import.meta.dirname, "..");
const core = join(root, "packages", "core");
const fromAwsBlocks = (path: string) => path.startsWith("@aws-blocks/");

// Core's server logic is written against the platform contract only (spec §8); AWS lives in
// @slidesend/aws.
describe("@slidesend/core never imports @aws-blocks", () => {
  it.each(["index", "server", "testing"])("entry %s", async (entry) => {
    const imports = await externalImportsOf(join(core, "src", `${entry}.ts`));
    expect(imports.filter(fromAwsBlocks)).toEqual([]);
  });

  it("declares no @aws-blocks dependency", () => {
    const manifest = JSON.parse(readFileSync(join(core, "package.json"), "utf8"));
    const declared = ["dependencies", "peerDependencies", "devDependencies"].flatMap((field) =>
      Object.keys(manifest[field] ?? {}),
    );
    expect(declared.filter(fromAwsBlocks)).toEqual([]);
  });

  it("detects such an import through an intermediate module", async () => {
    const imports = await externalImportsOf(
      join(import.meta.dirname, "fixtures", "aws-leak", "src", "index.ts"),
    );
    expect(imports.filter(fromAwsBlocks)).toEqual(["@aws-blocks/blocks"]);
  });
});
