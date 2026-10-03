import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deployWorkflow, pinnedActions } from "../packages/aws/src/workflow/template";

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

// Dependabot updates the pins in .github/workflows only. The workflow written for talks and the
// one shown in the docs must follow by hand, so a Dependabot pull request fails here until they do.
describe("the pins of the generated workflow", () => {
  const root = join(import.meta.dirname, "..");
  const folder = join(root, ".github", "workflows");
  const repositoryPins = new Map<string, string>();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".yml"))) {
    for (const line of usesOf(readFileSync(join(folder, file), "utf8"))) {
      const pin = line.slice("uses: ".length);
      repositoryPins.set(pin.split("@")[0] as string, pin);
    }
  }

  for (const [key, pin] of Object.entries(pinnedActions)) {
    const action = pin.split("@")[0] as string;
    it(`match the repository's own workflows for ${action}`, () => {
      // An action the repository does not use itself has nothing to be compared with.
      if (!repositoryPins.has(action)) return;
      expect({ [key]: pin }).toEqual({ [key]: repositoryPins.get(action) });
    });
  }

  it("match the workflow shown in continuous-deployment.md", () => {
    const doc = readFileSync(
      join(root, "packages", "aws", "docs", "continuous-deployment.md"),
      "utf8",
    );
    const shown = usesOf(doc).map((line) => line.slice("uses: ".length));
    expect(shown.length).toBeGreaterThan(0);
    for (const pin of shown) expect(Object.values(pinnedActions)).toContain(pin);
  });
});
