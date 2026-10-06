#!/usr/bin/env node
/**
 * Writes the rendered pages into dist/: the product page into dist/index.html, where React then
 * hydrates the copy buttons, and every doc into dist/docs/…/index.html, without any script.
 * Run after both Vite builds (see "build"). Fails on a link in the docs that resolves to nothing.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const site = join(import.meta.dirname, "..");
const root = join(site, "..");
const origin = "https://nxsflow.com";
const base = "/slidesend/";
const server = await import(pathToFileURL(join(site, "dist-server", "entry-server.js")).href);
const template = readFileSync(join(site, "dist", "index.html"), "utf8");
const marker = '<div id="root"></div>';
if (!template.includes(marker)) throw new Error(`dist/index.html has no ${marker}.`);

const attribute = (text) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

writeFileSync(
  join(site, "dist", "index.html"),
  template.replace(marker, `<div id="root">${server.render()}</div>`),
);

const docs = await server.renderDocs(root);
for (const { page, html } of docs) {
  const title = `${page.title} · slidesend docs`;
  const url = `${origin}${base}${page.route}`;
  const out = template
    // The docs need no JavaScript: the module script and its preloads are left out.
    .replace(/\s*<script type="module"[^>]*><\/script>/g, "")
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, "")
    .replace(/<title>[^<]*<\/title>/, `<title>${attribute(title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${attribute(page.description)}$2`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${attribute(page.description)}$2`,
    )
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${attribute(title)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(marker, `<div id="root">${html}</div>`);
  const folder = join(site, "dist", page.route);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "index.html"), out);
}
rmSync(join(site, "dist-server"), { recursive: true, force: true });
console.log(`Prerendered dist/index.html and ${docs.length} doc pages.`);
