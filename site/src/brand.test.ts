/**
 * The brand rules that live outside the rendered page: the icons in the document head, as the
 * logo guide of nxsflow/brand prescribes them, and the page's stylesheet, which takes every
 * colour from the brand tokens.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const head = read("../index.html");
const css = read("./site.css");

describe("the document head", () => {
  it("links the favicons of the logo guide: the .ico first, then the adaptive SVG", () => {
    const ico = head.indexOf('href="/slidesend/brand/slidesend-favicon-dark.ico" sizes="32x32"');
    const svg = head.indexOf('href="/slidesend/brand/slidesend-favicon.svg" type="image/svg+xml"');
    expect(ico).toBeGreaterThan(-1);
    expect(svg).toBeGreaterThan(ico);
    expect(head).toContain(
      'rel="apple-touch-icon" href="/slidesend/brand/slidesend-apple-touch-180.png"',
    );
  });

  it("colours the browser chrome in ink", () => {
    expect(head).toContain('<meta name="theme-color" content="#17151F" />');
  });
});

describe("the stylesheet", () => {
  it("names no colour of its own; every colour is a brand token", () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});
