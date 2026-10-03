import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(import.meta.dirname, "..", "scripts", "changeset-check.mjs");
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A repository with a main branch and a pull request branch on top of it. */
function repository() {
  const root = mkdtempSync(join(tmpdir(), "changeset-check-"));
  folders.push(root);
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  };
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  write("packages/core/src/index.ts", "export const a = 1;\n");
  write(".changeset/older.md", "---\n---\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("switch", "-q", "-c", "change");
  const check = () =>
    spawnSync(process.execPath, [script, "main"], { cwd: root, encoding: "utf8" });
  return { git, write, check };
}

describe("changeset-check.mjs on a real repository", () => {
  it("fails a package change whose only changeset file was deleted", () => {
    const repo = repository();
    repo.write("packages/core/src/index.ts", "export const a = 2;\n");
    repo.git("rm", "-q", ".changeset/older.md");
    repo.git("commit", "-q", "-am", "change");
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("adds no changeset");
  });

  it("passes the same change with a changeset added", () => {
    const repo = repository();
    repo.write("packages/core/src/index.ts", "export const a = 2;\n");
    repo.write(".changeset/new-one.md", '---\n"@slidesend/core": patch\n---\n\nA fix.\n');
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "change");
    expect(repo.check().status).toBe(0);
  });
});
