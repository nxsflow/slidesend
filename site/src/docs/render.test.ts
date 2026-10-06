/**
 * The docs as site pages. The Markdown stays what GitHub and a coding agent read; these tests pin
 * what the site makes of it — and that every link in the real docs lands somewhere on the site.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHighlighter, type Highlighter } from "shiki";
import { beforeAll, describe, expect, it } from "vitest";
import { createRenderer, docFiles, linkProblems, repositoryUrl, sidebarOf } from "./render";

let highlighter: Highlighter;
beforeAll(async () => {
  highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["ts", "sh"],
  });
});

/** A repository with the given files, for one test. */
function repository(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "site-docs-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function pagesOf(root: string) {
  const files = docFiles(root);
  const render = createRenderer({ root, files, base: "/slidesend/", highlighter });
  return files.map(render);
}

const fixture = {
  "packages/core/docs/README.md":
    "# Docs\n\nStart with [the guide](guide.md).\n\n- [agents](../../agent/docs/agents.md)\n",
  "packages/core/docs/guide.md": [
    "# The guide",
    "",
    "First paragraph with `code` and a [link](#the-deck).",
    "",
    "<!-- snippet: examples/x.ts#a -->",
    "```ts",
    "const a = 1;",
    "```",
    "<!-- end snippet -->",
    "",
    "## The deck",
    "",
    "Raw <b>html</b> stays text; <stackId>-prod too.",
    "",
    "See [agents](../../agent/docs/agents.md#define-the-agents) and [the example](../../../examples/talk/deck.ts).",
    "",
  ].join("\n"),
  "packages/agent/docs/agents.md": "# Agents\n\n## Define the agents\n\nText.\n",
  "examples/talk/deck.ts": "export {};\n",
};

describe("the docs on the site", () => {
  it("serves core's docs under docs/ and the other packages' under docs/<package>/", () => {
    expect(docFiles(repository(fixture)).map((file) => file.route)).toEqual([
      "docs/",
      "docs/guide/",
      "docs/agent/agents/",
    ]);
  });

  it("turns links between docs into routes and keeps their anchors", () => {
    const guide = pagesOf(repository(fixture)).find((page) => page.route === "docs/guide/");
    expect(guide?.html).toContain('href="/slidesend/docs/agent/agents/#define-the-agents"');
    expect(guide?.html).toContain('href="#the-deck"');
    expect(guide?.html).toContain('<h2 id="the-deck">');
  });

  it("sends a link to any other file of the repository to GitHub", () => {
    const guide = pagesOf(repository(fixture)).find((page) => page.route === "docs/guide/");
    expect(guide?.html).toContain(`href="${repositoryUrl}/examples/talk/deck.ts"`);
  });

  it("never passes raw HTML through, and leaves out the snippet markers", () => {
    const guide = pagesOf(repository(fixture)).find((page) => page.route === "docs/guide/");
    expect(guide?.html).toContain("Raw &lt;b&gt;html&lt;/b&gt; stays text; &lt;stackId&gt;-prod");
    expect(guide?.html).not.toContain("<b>");
    expect(guide?.html).not.toContain("snippet");
  });

  it("highlights code and reads title and description from the page", () => {
    const guide = pagesOf(repository(fixture)).find((page) => page.route === "docs/guide/");
    expect(guide?.html).toContain('<pre class="shiki');
    expect(guide?.title).toBe("The guide");
    expect(guide?.description).toBe("First paragraph with code and a link.");
  });

  it("finds a link to a missing file and a link to a missing heading", () => {
    const root = repository({
      ...fixture,
      "packages/core/docs/README.md":
        "# Docs\n\n[gone](gone.md) and [agents](../../agent/docs/agents.md#nope)\n",
    });
    expect(linkProblems(pagesOf(root))).toEqual([
      'packages/core/docs/README.md: "gone.md" points at nothing in the repository',
      'packages/core/docs/README.md: "../../agent/docs/agents.md#nope" points at a heading that does not exist',
    ]);
  });

  it("builds the sidebar from the core README, named by each page's title", () => {
    const root = repository(fixture);
    expect(sidebarOf(pagesOf(root), root)).toEqual([
      { route: "docs/", label: "Overview" },
      { route: "docs/guide/", label: "The guide" },
      { route: "docs/agent/agents/", label: "Agents" },
    ]);
  });

  it("resolves every link of the real docs on the site", async () => {
    const root = join(import.meta.dirname, "..", "..", "..");
    const all = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["ts", "tsx", "sh", "json", "yaml", "html", "markdown"],
    });
    const files = docFiles(root);
    const pages = files.map(createRenderer({ root, files, base: "/slidesend/", highlighter: all }));
    expect(pages.length).toBeGreaterThan(10);
    expect(linkProblems(pages)).toEqual([]);
  });
});
