import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlatformCommandContext } from "@slidesend/core";
import { afterEach, describe, expect, it } from "vitest";
import { dev } from "./commands";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** Writes a package into the project's node_modules whose one export is `source`. */
function fakePackage(projectRoot: string, name: string, subpath: string, source: string) {
  const folder = join(projectRoot, "node_modules", name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "package.json"),
    JSON.stringify({ name, type: "module", exports: { [subpath]: "./entry.js" } }),
  );
  writeFileSync(join(folder, "entry.js"), source);
}

/**
 * A talk project whose dev server loads `aws-blocks/index.ts` the way AWS Blocks' does: by file
 * URL, in this process.
 */
function project(entry: string): string {
  const root = mkdtempSync(join(tmpdir(), "slidesend-dev-"));
  folders.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "talk", type: "module" }));
  fakePackage(root, "tsx", "./esm/api", "export function register() {}");
  fakePackage(
    root,
    "@aws-blocks/blocks",
    "./scripts",
    `import { pathToFileURL } from "node:url";
     export async function startDevServer({ backendPath }) {
       await import(pathToFileURL(backendPath).href);
     }`,
  );
  mkdirSync(join(root, "aws-blocks"));
  writeFileSync(join(root, "aws-blocks", "index.ts"), entry);
  return root;
}

const context = (projectRoot: string): PlatformCommandContext =>
  ({ projectRoot, args: [], log: () => {} }) as unknown as PlatformCommandContext;

const namespace = `export const slidesend = Object.assign(() => ({}), {
  [Symbol.for("blocks:ApiNamespace")]: "slidesend",
});`;

describe("slidesend dev", () => {
  it("starts when the backend entry exports only API namespaces", async () => {
    await expect(dev(context(project(namespace)))).resolves.toBeUndefined();
  });

  it("stops when the backend entry exports anything else, and names it", async () => {
    const root = project(`${namespace}\nexport const backend = { methods: {} };`);
    await expect(dev(context(root))).rejects.toThrow(/Not an API namespace: "backend"/);
  });
});
