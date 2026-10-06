/** What every page of the site shares: the header with the wordmark, the footer, the links. */

export const base = import.meta.env.BASE_URL;

export const links = {
  github: "https://github.com/nxsflow/slidesend",
  npm: "https://www.npmjs.com/org/slidesend",
  docs: `${base}docs/`,
  nxsflow: "https://nxsflow.com",
  legal: "https://nxsflow.com/legal-notice",
  privacy: "https://nxsflow.com/privacy",
};

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a href={base} className="wordmark">
          <picture>
            <source
              srcSet={`${base}brand/slidesend-wordmark-light.svg`}
              media="(prefers-color-scheme: dark)"
            />
            <img
              src={`${base}brand/slidesend-wordmark-dark.svg`}
              alt="slidesend"
              width={140}
              height={30}
            />
          </picture>
        </a>
        <nav aria-label="Main">
          <a href={links.docs}>Docs</a>
          <a href={links.github}>GitHub</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <p>
          slidesend is open source under the Apache License 2.0. Made by{" "}
          <a href={links.nxsflow}>nxsflow</a>.
        </p>
        <nav aria-label="Legal">
          <a href={links.legal}>Legal notice</a>
          <a href={links.privacy}>Privacy policy</a>
        </nav>
      </div>
    </footer>
  );
}
