/**
 * The page as it is prerendered: what a crawler, a link preview and a reader without JavaScript
 * get. It checks the facts a reader acts on and the brand rules a change could quietly break.
 */
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const html = renderToString(<App />);
const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("the product page", () => {
  it("offers the install command, in the hero and at the end", () => {
    expect(html.match(/class="install"/g)).toHaveLength(2);
    expect(text).toContain("npm create @slidesend@latest my-talk");
  });

  it("writes the name in lowercase, also at the start of a sentence", () => {
    expect(text).not.toMatch(/Slidesend/);
    expect(text).toContain("slidesend is a presentation tool");
  });

  it("shows the wordmark in the header and never the icon", () => {
    expect(html).toContain("slidesend-wordmark-dark.svg");
    expect(html).not.toContain("slidesend-icon");
  });

  it("links to the code, the packages, the docs and nxsflow's legal pages", () => {
    for (const href of [
      "https://github.com/nxsflow/slidesend",
      "https://www.npmjs.com/org/slidesend",
      "https://github.com/nxsflow/slidesend/tree/main/packages/core/docs",
      "https://nxsflow.com/legal-notice",
      "https://nxsflow.com/privacy",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});
