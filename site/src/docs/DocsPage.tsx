import { base, SiteFooter, SiteHeader } from "../chrome";
import type { DocPage } from "./render";

/**
 * One page of the documentation: the sidebar from the core README, the rendered Markdown, and a
 * link to the same file on GitHub. The page carries no script; it is complete as HTML.
 */
export function DocsPage({
  page,
  sidebar,
  sourceUrl,
}: {
  page: DocPage;
  sidebar: { route: string; label: string }[];
  sourceUrl: string;
}) {
  return (
    <>
      <SiteHeader />
      <div className="wrap docs">
        <nav className="docs-nav" aria-label="Documentation">
          <ul>
            {sidebar.map((entry) => (
              <li key={entry.route}>
                <a
                  href={`${base}${entry.route}`}
                  aria-current={entry.route === page.route ? "page" : undefined}
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="doc">
          {/* Rendered at build time from the repository's own Markdown, with raw HTML off. */}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the docs of this repository, rendered without raw HTML */}
          <article dangerouslySetInnerHTML={{ __html: page.html }} />
          <p className="doc-source">
            <a href={sourceUrl}>View this page on GitHub</a>
          </p>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
