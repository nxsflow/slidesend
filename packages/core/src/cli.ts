#!/usr/bin/env node
/**
 * The `slidesend` command (spec §14). It loads the talk project's `presentation.config.ts` through
 * Vite, so the config may import TSX components exactly as the app does.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCommandLine, runCommand } from "./cli/commands";
import type { Presentation } from "./deck/presentation";

const projectRoot = process.cwd();

async function vite() {
  try {
    return await import("vite");
  } catch {
    throw new Error("slidesend needs Vite in the talk project: npm install -D vite");
  }
}

const exitCode = await runCommand(
  {
    projectRoot,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    async loadPresentation(configFile) {
      const { createServer } = await vite();
      const server = await createServer({
        root: projectRoot,
        logLevel: "silent",
        server: { middlewareMode: true, hmr: false },
        appType: "custom",
        // Load Slidesend's own packages with Node, as an installed package would be loaded, even
        // when a workspace links them: their commands import more modules after this server closed.
        ssr: {
          external: ["@slidesend/core", "@slidesend/basics", "@slidesend/aws", "@slidesend/agent"],
        },
      });
      try {
        const file = pathToFileURL(resolve(projectRoot, configFile)).pathname;
        const module = await server.ssrLoadModule(file);
        const presentation = module.default as Presentation | undefined;
        if (!presentation?.steps) {
          throw new Error("its default export must be the result of definePresentation(...).");
        }
        return presentation;
      } finally {
        await server.close();
      }
    },
    async startDevServer(port) {
      const { createServer } = await vite();
      const server = await createServer({ root: projectRoot, server: { port } });
      await server.listen();
      return server.resolvedUrls?.local[0] ?? `http://localhost:${port ?? 5173}/`;
    },
  },
  parseCommandLine(process.argv.slice(2)),
);

// `dev` keeps running with its server; every other command ends here.
if (exitCode !== 0 || process.argv[2] !== "dev") process.exit(exitCode);
