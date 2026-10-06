import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { createHighlighter } from "shiki";
import { App } from "./App";
import { base } from "./chrome";
import { DocsPage } from "./docs/DocsPage";
import {
  createRenderer,
  type DocPage,
  docFiles,
  linkProblems,
  repositoryUrl,
  sidebarOf,
} from "./docs/render";

/** The product page as HTML, for scripts/prerender.mjs; React hydrates it for the copy buttons. */
export function render(): string {
  return renderToString(<App />);
}

/** The languages the docs' code blocks use; anything else is shown as plain text. */
const languages = ["ts", "tsx", "sh", "json", "yaml", "html", "markdown"];

/** Every doc as a page, from the Markdown under `root`/packages/<name>/docs. */
export async function renderDocs(root: string): Promise<{ page: DocPage; html: string }[]> {
  const highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: languages,
  });
  const files = docFiles(root);
  const renderDoc = createRenderer({ root, files, base, highlighter });
  const pages = files.map(renderDoc);
  const problems = linkProblems(pages);
  if (problems.length > 0) throw new Error(`Broken links in the docs:\n${problems.join("\n")}`);
  const sidebar = sidebarOf(pages, root);
  return pages.map((page) => ({
    page,
    html: renderToStaticMarkup(
      <DocsPage page={page} sidebar={sidebar} sourceUrl={`${repositoryUrl}/${page.path}`} />,
    ),
  }));
}
