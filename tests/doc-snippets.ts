import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Code samples in the docs are copies of real, tested files (spec §15). A source file marks a
 * region with `// snippet: <name>` and `// end snippet`; a document embeds it between
 *
 *     <!-- snippet: examples/gravity/src/plugin.tsx#define-block -->
 *     <!-- end snippet -->
 *
 * and everything between those two lines is generated: a fenced block with the region, its
 * common indentation removed.
 */

/** The repository root. */
export const repositoryRoot = join(import.meta.dirname, "..");

/** Every document that may embed snippets: the README and the docs shipped in the packages. */
export function documents(root = repositoryRoot): string[] {
  const packages = join(root, "packages");
  const docs = readdirSync(packages).flatMap((name) => {
    const folder = join(packages, name, "docs");
    try {
      return readdirSync(folder)
        .filter((file) => file.endsWith(".md"))
        .map((file) => join(folder, file));
    } catch {
      return [];
    }
  });
  return [join(root, "README.md"), ...docs];
}

/** The region `name` of a source file, without its markers and common indentation. */
export function region(source: string, name: string, file = "the source"): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim() === `// snippet: ${name}`);
  if (start < 0) throw new Error(`${file} has no snippet "${name}".`);
  const length = lines.slice(start + 1).findIndex((line) => line.trim() === "// end snippet");
  if (length < 0) throw new Error(`The snippet "${name}" in ${file} is never ended.`);
  const body = lines.slice(start + 1, start + 1 + length);
  const indent = Math.min(
    ...body.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return body
    .map((line) => line.slice(indent))
    .join("\n")
    .trim();
}

const embedded = /(<!-- snippet: (\S+?)#(\S+) -->\n)[\s\S]*?(<!-- end snippet -->)/g;

/** The document with every embedded snippet regenerated from its source. */
export function embedSnippets(document: string, root = repositoryRoot): string {
  return document.replace(embedded, (_match, open: string, path: string, name: string, close) => {
    const source = readFileSync(join(root, path), "utf8");
    const language = extname(path).slice(1);
    return `${open}\`\`\`${language}\n${region(source, name, path)}\n\`\`\`\n${close}`;
  });
}
