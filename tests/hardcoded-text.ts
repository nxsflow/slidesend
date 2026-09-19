import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Props whose text a person reads. */
const textProps = /\b(alt|title|placeholder|aria-label)=["']([^"']{3,})["']/g;
/** Text between JSX tags, e.g. `<p>Hello</p>`. */
const jsxText = />([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g;
/** Code, not text: generics and calls also put words between `>` and `<`. */
const looksLikeCode = /[();=`$]|=>/;
const allowMarker = "slidesend-allow-hardcoded-text";

/**
 * Finds user-visible text written into components instead of the message catalog (spec §6.5).
 * Tests and files with the opt-out marker are skipped.
 */
export function findHardcodedText(root: string): string[] {
  const findings: string[] = [];
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist") visit(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) continue;
      const text = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      if (text.includes(allowMarker)) continue;
      text.split("\n").forEach((line, index) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        for (const pattern of [textProps, jsxText]) {
          for (const match of line.matchAll(pattern)) {
            const found = (match[2] ?? match[1] ?? "").trim();
            if (!found) continue;
            if (pattern === jsxText && looksLikeCode.test(found)) continue;
            findings.push(`${relative(root, path)}:${index + 1}: ${found}`);
          }
        }
      });
    }
  };
  visit(root);
  return findings;
}
