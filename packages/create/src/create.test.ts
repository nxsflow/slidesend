import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  dependencyOf,
  nameProblem,
  nextSteps,
  type Plan,
  packageManagerOf,
  parseArgs,
  runCommand,
  stackIdOf,
  writeProject,
} from "./create";

const packageRoot = resolve(import.meta.dirname, "..");
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function plan(overrides: Partial<Plan> = {}): Plan {
  const parent = mkdtempSync(join(tmpdir(), "create-slidesend-"));
  folders.push(parent);
  return {
    name: "my-talk",
    target: join(parent, "my-talk"),
    aws: false,
    packageManager: "npm",
    source: { version: "0.1.0" },
    packageRoot,
    ...overrides,
  };
}
const read = (file: string) => readFileSync(file, "utf8");
const manifest = (target: string) =>
  JSON.parse(read(join(target, "package.json"))) as {
    name: string;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

describe("parseArgs", () => {
  it("reads a name and every flag", () => {
    expect(
      parseArgs(["talk", "--yes", "--no-install", "--aws", "--package-manager", "pnpm"]),
    ).toEqual({
      name: "talk",
      yes: true,
      install: false,
      aws: true,
      packageManager: "pnpm",
      help: false,
    });
  });

  it("refuses an unknown option, an unknown package manager and a second name", () => {
    expect(() => parseArgs(["--force"])).toThrow("Unknown option --force");
    expect(() => parseArgs(["--package-manager", "make"])).toThrow("npm, pnpm, yarn or bun");
    expect(() => parseArgs(["a", "b"])).toThrow("One folder name");
  });
});

describe("names", () => {
  it("accepts a package-like folder name and explains what it refuses", () => {
    expect(nameProblem("my-talk")).toBeUndefined();
    expect(nameProblem("My Talk")).toContain("lowercase");
    expect(nameProblem("")).toBe("The name is empty.");
  });

  it("derives a short stack id for AWS Blocks", () => {
    expect(stackIdOf("my-talk")).toBe("sd-my-talk");
    expect(stackIdOf("a.very_long-name-for-a-talk").length).toBeLessThanOrEqual(16);
    expect(stackIdOf("a.very_long-name-for-a-talk")).not.toMatch(/-$/);
  });
});

describe("package managers", () => {
  it("takes the one that runs the command from its user agent", () => {
    expect(packageManagerOf("pnpm/12.3.4 npm/? node/v24.21.0 darwin arm64")).toBe("pnpm");
    expect(packageManagerOf("yarn/4.5.0 npm/? node/v24")).toBe("yarn");
    expect(packageManagerOf("")).toBe("npm");
  });

  it("writes run commands the way each one spells them", () => {
    expect(runCommand("npm", "dev")).toBe("npm run dev");
    expect(runCommand("pnpm", "deploy")).toBe("pnpm run deploy");
    expect(runCommand("yarn", "dev")).toBe("yarn dev");
    expect(runCommand("npm", "deploy", "--profile x")).toBe("npm run deploy -- --profile x");
    expect(runCommand("pnpm", "deploy", "--profile x")).toBe("pnpm run deploy --profile x");
    expect(runCommand("bun", "dev")).toBe("bun run dev");
  });
});

describe("dependencies", () => {
  it("uses the released version, or a packed tarball for tests", () => {
    expect(dependencyOf("@slidesend/core", { version: "0.1.0" })).toBe("^0.1.0");
    expect(dependencyOf("@slidesend/core", { version: "0.1.0", tarballs: "/packs" })).toBe(
      "file:/packs/slidesend-core-0.1.0.tgz",
    );
  });
});

describe("writeProject", () => {
  it("writes the local starter talk with released versions and a real .gitignore", () => {
    const local = plan();
    writeProject(local);
    const written = manifest(local.target);
    expect(written.name).toBe("my-talk");
    expect(written.dependencies["@slidesend/core"]).toBe("^0.1.0");
    expect(written.dependencies["@slidesend/aws"]).toBeUndefined();
    expect(written.scripts.dev).toBe("vite --mode bridge --host");
    expect(Object.values(written.dependencies)).not.toContain("workspace:*");
    expect(existsSync(join(local.target, ".gitignore"))).toBe(true);
    expect(existsSync(join(local.target, "_gitignore"))).toBe(false);
    expect(existsSync(join(local.target, "node_modules"))).toBe(false);
    expect(read(join(local.target, "AGENTS.md"))).toContain("node_modules/@slidesend/core");
    expect(existsSync(join(local.target, "aws-blocks"))).toBe(false);
  });

  it("lays the AWS variant over it, with its own stack id and scripts", () => {
    const aws = plan({ name: "gravity-talk", aws: true });
    writeProject(aws);
    const written = manifest(aws.target);
    expect(written.dependencies["@slidesend/aws"]).toBe("^0.1.0");
    expect(written.dependencies["aws-blocks"]).toBe("file:./aws-blocks");
    expect(written.scripts.dev).toBe("slidesend dev");
    expect(written.scripts.deploy).toBe("slidesend deploy");
    expect(written.devDependencies["aws-cdk"]).toBeDefined();
    expect(JSON.parse(read(join(aws.target, ".blocks", "config.json")))).toEqual({
      stackId: "sd-gravity-talk",
    });
    expect(read(join(aws.target, "presentation.config.ts"))).toContain("platform: aws(");
    expect(read(join(aws.target, ".gitignore"))).toContain("aws-blocks/client.js");
    expect(existsSync(join(aws.target, "package.overlay.json"))).toBe(false);
  });

  it("links aws-blocks for pnpm, which would copy a file: folder", () => {
    const aws = plan({ aws: true, packageManager: "pnpm" });
    writeProject(aws);
    expect(manifest(aws.target).dependencies["aws-blocks"]).toBe("link:./aws-blocks");
  });

  it("refuses a folder that is not empty, and leaves it alone", () => {
    const taken = plan();
    mkdirSync(taken.target);
    writeFileSync(join(taken.target, "notes.txt"), "mine");
    expect(() => writeProject(taken)).toThrow("already exists and is not empty");
    expect(read(join(taken.target, "notes.txt"))).toBe("mine");
  });
});

describe("nextSteps", () => {
  it("says how to start the talk and open desk and stage", () => {
    const text = nextSteps(plan({ packageManager: "pnpm" }), true).join("\n");
    expect(text).toContain("cd my-talk");
    expect(text).toContain("pnpm run dev");
    expect(text).toContain("#key=");
    expect(text).toContain("Open the stage");
    expect(text).toContain("for phones on this network");
    expect(text).toContain("open this folder in yours and ask it to change the");
    expect(text).not.toContain("pnpm install");
  });

  it("adds the install when it was skipped, and the deploy for AWS", () => {
    const text = nextSteps(plan({ aws: true }), false).join("\n");
    expect(text).toContain("npm install");
    expect(text).toContain("deploy-aws.md");
    expect(text).toContain("npm run deploy -- --profile");
  });
});
