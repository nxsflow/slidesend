import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Named colors that most often slip into styles; the list does not need to be complete. */
const named =
  "black|white|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|brown|navy|teal|olive|maroon|aqua|fuchsia|lime|whitesmoke|gold|beige|ivory";

const rules: { name: string; pattern: RegExp }[] = [
  {
    name: "hex color",
    pattern: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  },
  { name: "color function", pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g },
  {
    name: "named color",
    pattern: new RegExp(
      `(?:color|background|border|fill|stroke|outline|shadow)[\\w-]*\\s*:\\s*["'\`]?[^;"'\`}]*?\\b(?:${named})\\b`,
      "gi",
    ),
  },
  { name: "font family", pattern: /font-family\s*:\s*(?!\s*var\()/g },
  { name: "font family", pattern: /fontFamily\s*:\s*["'`](?!var\()/g },
];

/** Opt-out marker for a file that must contain literal values, such as a design's tokens. */
const allowMarker = "slidesend-allow-literal-styles";

/**
 * Finds literal colors and font families in the CSS and component files under `root`
 * (spec §7, epic Styling decision): every color and font there must be a design token.
 * Tests and files with the opt-out marker are skipped.
 */
export function findLiteralStyles(root: string): string[] {
  const findings: string[] = [];
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist") visit(path);
        continue;
      }
      if (!/\.(css|tsx)$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) continue;
      const text = readFileSync(path, "utf8");
      if (text.includes(allowMarker)) continue;
      text.split("\n").forEach((line, index) => {
        for (const { name, pattern } of rules) {
          for (const match of line.matchAll(pattern)) {
            findings.push(`${relative(root, path)}:${index + 1}: ${name} "${match[0].trim()}"`);
          }
        }
      });
    }
  };
  visit(root);
  return findings;
}
