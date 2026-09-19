import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { build } from "esbuild";

/**
 * Walks the import graph of a package's browser entry (`src/index.ts`) and returns every way it
 * reaches server code: the package's own server entry (`src/server.ts` or anything under
 * `src/server/`), or the `./server` entry of any `@slidesend` package.
 */
export async function serverImportsOfBrowserEntry(packageDir: string): Promise<string[]> {
  const entry = join(packageDir, "src", "index.ts");
  if (!existsSync(entry)) throw new Error(`missing browser entry ${entry}`);

  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    packages: "external",
    platform: "neutral",
    format: "esm",
    logLevel: "silent",
  });

  const serverFile = join("src", "server.ts");
  const serverDir = join("src", "server") + sep;
  const leaks: string[] = [];
  for (const [input, { imports }] of Object.entries(result.metafile.inputs)) {
    const file = relative(packageDir, input);
    if (file === serverFile || file.startsWith(serverDir)) leaks.push(file);
    for (const { path, external } of imports) {
      if (external && /^@slidesend\/[^/]+\/server(\/|$)/.test(path))
        leaks.push(`${file} -> ${path}`);
    }
  }
  return leaks;
}

/**
 * Every package outside the bundle that a source file reaches, following its imports within the
 * package: the import paths of all external modules.
 */
export async function externalImportsOf(entry: string): Promise<string[]> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    packages: "external",
    platform: "neutral",
    format: "esm",
    logLevel: "silent",
  });
  const paths = new Set<string>();
  for (const { imports } of Object.values(result.metafile.inputs)) {
    for (const { path, external } of imports) if (external) paths.add(path);
  }
  return [...paths].sort();
}
