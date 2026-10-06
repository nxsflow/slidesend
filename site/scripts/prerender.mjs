#!/usr/bin/env node
/**
 * Writes the rendered page into dist/index.html, so the page is complete without JavaScript and
 * the copy buttons are all that React adds. Run after both Vite builds (see "build").
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const site = join(import.meta.dirname, "..");
const { render } = await import(pathToFileURL(join(site, "dist-server", "entry-server.js")).href);
const file = join(site, "dist", "index.html");
const html = readFileSync(file, "utf8");
const marker = '<div id="root"></div>';
if (!html.includes(marker)) throw new Error(`dist/index.html has no ${marker}.`);
writeFileSync(file, html.replace(marker, `<div id="root">${render()}</div>`));
rmSync(join(site, "dist-server"), { recursive: true, force: true });
console.log("Prerendered dist/index.html.");
