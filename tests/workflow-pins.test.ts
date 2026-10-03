import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deployWorkflow } from "../packages/aws/src/workflow/template";

// Actions are pinned to commits, never to tags that can be moved to other code (mr4g); the
// version stays readable as a comment, and Dependabot (.github/dependabot.yml) updates both.
const pinned = /^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
const usesOf = (yaml: string) =>
  yaml
    .split("\n")
    .map((line) => line.trim().replace(/^- /, ""))
    .filter((line) => line.startsWith("uses: "));

describe("pinned actions", () => {
  const folder = join(import.meta.dirname, "..", ".github", "workflows");
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".yml"))) {
    it(`pins every action in ${file} to a commit`, () => {
      const uses = usesOf(readFileSync(join(folder, file), "utf8"));
      expect(uses.length).toBeGreaterThan(0);
      expect(uses.filter((line) => !pinned.test(line))).toEqual([]);
    });
  }

  it("pins every action in the workflow slidesend writes for a talk", () => {
    for (const packageManager of ["pnpm", "npm"] as const) {
      const yaml = deployWorkflow({
        talkDir: "",
        packageManager,
        rootCheck: false,
        playwright: false,
        environment: "production",
        branch: "main",
      });
      expect(usesOf(yaml).filter((line) => !pinned.test(line))).toEqual([]);
    }
  });
});
