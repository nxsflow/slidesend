import { describe, expect, it } from "vitest";
import {
  distTagOf,
  notesOf,
  npmState,
  pendingChangesets,
  planOf,
  standDownOf,
  // @ts-expect-error -- a plain ES module without types, run by CI as it is
} from "../scripts/release-plan.mjs";

describe("the release plan", () => {
  it("takes the dist-tag from the version, not from the pre mode", () => {
    expect(distTagOf("0.1.0-alpha.0")).toBe("alpha");
    expect(distTagOf("1.2.0-beta.4")).toBe("beta");
    expect(distTagOf("1.2.0")).toBe("latest");
    expect(() => distTagOf("next")).toThrow("not a version");
  });

  it("cuts the release notes out of the changelog", () => {
    const changelog = [
      "# @slidesend/core",
      "",
      "## 0.2.0-alpha.1",
      "",
      "### Patch Changes",
      "",
      "- Fixed a thing.",
      "",
      "## 0.2.0-alpha.0",
      "",
      "- Older.",
    ].join("\n");
    expect(notesOf(changelog, "0.2.0-alpha.1")).toBe("### Patch Changes\n\n- Fixed a thing.\n");
    expect(notesOf(changelog, "0.2.0-alpha.0")).toBe("- Older.\n");
    expect(() => notesOf(changelog, "9.9.9")).toThrow('no section "## 9.9.9"');
  });

  it("counts only top-level changesets, not the README or what pre mode keeps", () => {
    expect(
      pendingChangesets(["README.md", "config.json", "pre.json", "pre", "brave-owl.md"]),
    ).toEqual(["brave-owl.md"]);
  });

  it("tells published from missing, and refuses to guess on an error", () => {
    expect(npmState({ status: 0, stdout: "0.1.0-alpha.0\n", stderr: "" })).toBe("published");
    // A package that exists, in a version that does not.
    expect(npmState({ status: 0, stdout: "", stderr: "" })).toBe("missing");
    // A package that does not exist yet.
    expect(npmState({ status: 1, stdout: "", stderr: "npm error code E404" })).toBe("missing");
    expect(() => npmState({ status: 1, stdout: "", stderr: "npm error code ECONNRESET" })).toThrow(
      "npm could not be asked",
    );
  });

  it("releases a new version: commit, tag and publish", () => {
    expect(
      planOf({
        before: "0.0.0",
        after: "0.1.0-alpha.0",
        dirty: true,
        missing: ["@slidesend/core"],
      }),
    ).toEqual({
      version: "0.1.0-alpha.0",
      distTag: "alpha",
      commit: true,
      tag: true,
      publish: true,
    });
  });

  it("consumes an empty changeset without a version, a tag or a publish", () => {
    expect(planOf({ before: "0.1.0", after: "0.1.0", dirty: true, missing: [] })).toEqual({
      version: "0.1.0",
      distTag: "latest",
      commit: true,
      tag: false,
      publish: false,
    });
  });

  it("finishes a release that stopped after its commit: publish only what is missing", () => {
    expect(
      planOf({ before: "0.1.0", after: "0.1.0", dirty: false, missing: ["@slidesend/aws"] }),
    ).toMatchObject({ commit: false, tag: false, publish: true });
  });

  it("publishes nothing before the first version", () => {
    expect(
      planOf({ before: "0.0.0", after: "0.0.0", dirty: false, missing: ["@slidesend/core"] }),
    ).toMatchObject({ publish: false });
  });

  it("releases while main is still where the run checked out", () => {
    const sha = "a".repeat(40);
    expect(standDownOf({ base: sha, tip: sha })).toEqual({ current: true });
  });

  it("stands down when a newer merge moved main on, and says which run releases", () => {
    const decision = standDownOf({ base: "a".repeat(40), tip: "b".repeat(40) });
    expect(decision.current).toBe(false);
    expect(decision.notice).toContain("aaaaaaa to bbbbbbb");
    expect(decision.notice).toContain("newer push releases");
  });

  it("refuses to decide when the tip of main could not be read", () => {
    expect(() => standDownOf({ base: "a".repeat(40), tip: "" })).toThrow("tip of main");
  });
});
