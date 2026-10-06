/**
 * The documentation of packages/<name>/docs as site pages, rendered at build time.
 *
 * The docs are written for two readers at once: a coding agent that finds them in node_modules,
 * and GitHub, which renders them in the repository. So they stay plain Markdown with relative
 * links, and this module turns them into pages: links between docs become site routes, links to
 * anything else in the repository go to GitHub, headings keep GitHub's anchors, and code is
 * highlighted. Raw HTML in the Markdown is never passed through; it is shown as text.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import GithubSlugger from "github-slugger";
import MarkdownIt from "markdown-it";
import type { Highlighter } from "shiki";

/** Where links into the repository go that are not docs of their own. */
export const repositoryUrl = "https://github.com/nxsflow/slidesend/blob/main";

/** One document: where it lives in the repository and where it is served on the site. */
export interface DocFile {
  /** Repository-relative, e.g. `packages/core/docs/plugins.md`. */
  path: string;
  /** Site route below the base, e.g. `docs/plugins/`; the core README is `docs/`. */
  route: string;
}

/** A rendered page. */
export interface DocPage extends DocFile {
  title: string;
  /** The first paragraph, as plain text, for the meta description. */
  description: string;
  html: string;
  /** The ids of every heading, for anchors from other pages. */
  anchors: string[];
  /** Links that point at a doc, as `route#anchor` (anchor may be empty), to check afterwards. */
  internal: { href: string; route: string; anchor: string }[];
  /** Links that resolve to nothing in the repository. */
  broken: string[];
}

/**
 * Every doc of every package. Core's docs are the main set and sit directly under `docs/`; the
 * other packages' docs under `docs/<package>/`, since two packages both have a `nodes.md`.
 */
export function docFiles(root: string): DocFile[] {
  const packages = readdirSync(join(root, "packages")).filter((name) =>
    existsSync(join(root, "packages", name, "docs")),
  );
  const ordered = ["core", ...packages.filter((name) => name !== "core").sort()];
  return ordered.flatMap((name) =>
    readdirSync(join(root, "packages", name, "docs"))
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map((file) => {
        const stem = file === "README.md" ? "" : `${file.slice(0, -3)}/`;
        const prefix = name === "core" ? "docs/" : `docs/${name}/`;
        return { path: `packages/${name}/docs/${file}`, route: `${prefix}${stem}` };
      }),
  );
}

/** The plain text of a heading's inline tokens, as GitHub slugs it. */
function inlineText(content: string): string {
  return content.replace(/`/g, "");
}

/** A Markdown renderer for one site: links resolved against `files`, code by `highlighter`. */
export function createRenderer(options: {
  root: string;
  files: readonly DocFile[];
  base: string;
  highlighter: Highlighter;
}) {
  const { root, files, base, highlighter } = options;
  const byPath = new Map(files.map((file) => [file.path, file]));
  const languages = new Set(highlighter.getLoadedLanguages());

  return function render(file: DocFile): DocPage {
    const source = readFileSync(join(root, file.path), "utf8")
      // The docs-test markers (`<!-- snippet: … -->`) are for the tests, not for readers.
      .replace(/<!--[\s\S]*?-->\n?/g, "");
    const page: DocPage = {
      ...file,
      title: "",
      description: "",
      html: "",
      anchors: [],
      internal: [],
      broken: [],
    };
    const slugger = new GithubSlugger();

    const md = new MarkdownIt({
      html: false,
      linkify: false,
      highlight(code, info) {
        const language = info.trim().split(/\s+/)[0] || "text";
        const lang = languages.has(language) ? language : "text";
        return highlighter.codeToHtml(code.replace(/\n$/, ""), {
          lang,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
        });
      },
    });

    // Headings get GitHub's ids, so `page.md#a-heading` links keep working.
    md.core.ruler.push("heading_ids", (state) => {
      state.tokens.forEach((token, index) => {
        if (token.type !== "heading_open") return;
        const text = inlineText(state.tokens[index + 1]?.content ?? "");
        const id = slugger.slug(text);
        token.attrSet("id", id);
        page.anchors.push(id);
        if (token.tag === "h1" && !page.title) page.title = text;
      });
      const paragraph = state.tokens.findIndex((token) => token.type === "paragraph_open");
      const inline = state.tokens[paragraph + 1];
      if (paragraph >= 0 && inline) {
        page.description = inline.content
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/[`*_]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }
    });

    const linkOpen =
      md.renderer.rules.link_open ??
      ((tokens, index, opts, _env, self) => self.renderToken(tokens, index, opts));
    md.renderer.rules.link_open = (tokens, index, opts, env, self) => {
      const token = tokens[index];
      const href = String(token?.attrGet("href") ?? "");
      if (token) token.attrSet("href", resolveHref(href));
      return linkOpen(tokens, index, opts, env, self);
    };

    function resolveHref(href: string): string {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
      const [target = "", anchor = ""] = href.split("#");
      if (!target) {
        page.internal.push({ href, route: file.route, anchor });
        return `#${anchor}`;
      }
      const path = posix.normalize(posix.join(posix.dirname(file.path), target));
      const doc = byPath.get(path);
      if (doc) {
        page.internal.push({ href, route: doc.route, anchor });
        return `${base}${doc.route}${anchor ? `#${anchor}` : ""}`;
      }
      const absolute = join(root, path);
      if (path.startsWith("..") || !existsSync(absolute)) {
        page.broken.push(href);
        return href;
      }
      const kind = statSync(absolute).isDirectory() ? "tree" : "blob";
      const url = `${repositoryUrl.replace("/blob/", `/${kind}/`)}/${relative(root, absolute)}`;
      return `${url}${anchor ? `#${anchor}` : ""}`;
    }

    page.html = md.render(source);
    if (!page.title) page.title = posix.basename(file.path, ".md");
    return page;
  };
}

/**
 * What is wrong with a set of pages: links to nothing, and links to a heading the target page
 * does not have. Empty when every link resolves on the site.
 */
export function linkProblems(pages: readonly DocPage[]): string[] {
  const anchors = new Map(pages.map((page) => [page.route, new Set(page.anchors)]));
  return pages.flatMap((page) => [
    ...page.broken.map((href) => `${page.path}: "${href}" points at nothing in the repository`),
    ...page.internal
      .filter(({ route, anchor }) => anchor && !anchors.get(route)?.has(anchor))
      .map(({ href }) => `${page.path}: "${href}" points at a heading that does not exist`),
  ]);
}

/**
 * The sidebar: every doc the core README links to, in its order, after the README itself, each
 * named by its own title.
 */
export function sidebarOf(
  pages: readonly DocPage[],
  root: string,
): { route: string; label: string }[] {
  const readme = pages.find((page) => page.route === "docs/");
  if (!readme) return [];
  const source = readFileSync(join(root, readme.path), "utf8");
  const entries = [{ route: readme.route, label: "Overview" }];
  for (const [, href = ""] of source.matchAll(/\]\(([^)#]+\.md)[^)]*\)/g)) {
    const path = posix.normalize(posix.join(dirname(readme.path), href));
    const page = pages.find((candidate) => candidate.path === path);
    if (page && !entries.some((entry) => entry.route === page.route)) {
      entries.push({ route: page.route, label: page.title });
    }
  }
  return entries;
}
