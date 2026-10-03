import { describe, expect, it } from "vitest";
// @ts-expect-error -- a plain ES module without types, run by CI as it is
import { changesetProblem, shipsInAPackage } from "../scripts/changeset-rule.mjs";

describe("the changeset rule", () => {
  it("asks for a changeset when a package changes what it ships", () => {
    expect(changesetProblem(["packages/core/src/deck/deck.ts"])).toContain("adds no changeset");
    expect(changesetProblem(["packages/aws/docs/deploy-aws.md"])).toContain("pnpm changeset");
    expect(changesetProblem(["packages/create/template/src/deck.ts"])).toBeDefined();
  });

  it("is satisfied by any changeset, an empty one included", () => {
    expect(
      changesetProblem(["packages/core/src/index.ts", ".changeset/quiet-owls-sing.md"]),
    ).toBeUndefined();
  });

  it("does not count tests, the workspace, or the changeset README", () => {
    expect(shipsInAPackage("packages/core/src/deck/deck.test.ts")).toBe(false);
    expect(
      changesetProblem(["tests/cli.test.ts", "README.md", "examples/gravity/src/deck.ts"]),
    ).toBeUndefined();
    expect(changesetProblem(["packages/core/src/index.ts", ".changeset/README.md"])).toBeDefined();
  });
});
