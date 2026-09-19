import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandReferenceTable } from "../packages/core/src/cli/commands";

const root = join(import.meta.dirname, "..");
const cli = join(root, "packages", "core", "dist", "cli.js");
const gravity = join(root, "examples", "gravity");

function slidesend(...args: string[]) {
  if (!existsSync(cli)) throw new Error("Build first: pnpm build (the CLI runs from dist).");
  return spawnSync(process.execPath, [cli, ...args], { cwd: gravity, encoding: "utf8" });
}

describe("slidesend", () => {
  it("check validates the example talk", () => {
    const result = slidesend("check");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^The deck is valid: 2 slides, 7 steps, 7 planned minutes\./);
  });

  it("check exits non-zero and names every problem of a broken deck", () => {
    const result = slidesend("check", "--config", "fixtures/broken/presentation.config.ts");
    expect(result.status).toBe(1);
    expect(result.stderr.trim().split("\n")).toEqual([
      "The deck has 2 problem(s):",
      '  slide "outro-1" (slides[0]) chapter: No chapter has the id "outro".',
      '  slide "intro-1" (slides[1]) title: Too small: expected string to have >=1 characters',
    ]);
  });

  it("explains that deploy needs a platform", () => {
    const result = slidesend("deploy");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/needs a platform, and none is configured/);
  });

  it("dev prints stage and desk links that work, in local mode", async () => {
    if (!existsSync(cli)) throw new Error("Build first: pnpm build (the CLI runs from dist).");
    const port = "5306";
    const child = spawn(process.execPath, [cli, "dev", "--port", port], { cwd: gravity });
    try {
      const output = await new Promise<string>((resolve, reject) => {
        let text = "";
        const timer = setTimeout(() => reject(new Error(`no links printed:\n${text}`)), 30_000);
        child.stdout.on("data", (chunk) => {
          text += chunk;
          if (text.includes("Phones")) {
            clearTimeout(timer);
            resolve(text);
          }
        });
      });
      const links = [...output.matchAll(/(Stage|Desk)\s+(http\S+)/g)].map((match) => match[2]);
      expect(links).toEqual([
        `http://localhost:${port}/stage/local`,
        `http://localhost:${port}/desk`,
      ]);
      for (const link of links) {
        const response = await fetch(link as string);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('<div id="root">');
      }
      expect(output).toContain("local mode: no audience can join");
      expect(output).not.toContain("#key=");
    } finally {
      child.kill();
    }
  }, 40_000);
});

// The command reference is generated from the command definitions (spec §15).
it("keeps packages/core/docs/commands.md in step with the commands", () => {
  const file = join(root, "packages", "core", "docs", "commands.md");
  const expected = `# The slidesend command\n\nGenerated from the code; run the tests with UPDATE_DOCS=1 to refresh.\n\n${commandReferenceTable()}`;
  if (process.env.UPDATE_DOCS) writeFileSync(file, expected);
  expect(readFileSync(file, "utf8")).toBe(expected);
});
