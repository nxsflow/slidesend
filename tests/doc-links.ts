import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** GitHub's anchor for a heading: lowercase, punctuation dropped, spaces as dashes. */
export function anchorOf(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- _]/gu, "")
    .replace(/ /g, "-");
}

const withoutFences = (text: string) => text.replace(/```[\s\S]*?```/g, "");

/** The anchors a Markdown document offers. */
export function anchorsOf(text: string): Set<string> {
  const headings = withoutFences(text).matchAll(/^#+ (.*)$/gm);
  return new Set([...headings].map((match) => anchorOf((match[1] ?? "").replace(/`/g, ""))));
}

/**
 * The relative links of a document that lead nowhere: a missing file, or a missing heading in a
 * Markdown file. Links to other sites are not checked; they would make the check depend on the
 * network.
 */
export function brokenLinks(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const prose = withoutFences(text);
  const problems: string[] = [];
  for (const match of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    const link = match[1] as string;
    if (/^[a-z]+:/.test(link)) continue;
    const [path, anchor] = link.split("#") as [string, string | undefined];
    const target = path ? join(dirname(file), path) : file;
    if (!existsSync(target)) {
      problems.push(`${link}: no such file`);
      continue;
    }
    if (anchor && target.endsWith(".md") && !anchorsOf(readFileSync(target, "utf8")).has(anchor)) {
      problems.push(`${link}: no such heading`);
    }
  }
  return problems;
}
