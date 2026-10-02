/**
 * The commands `@slidesend/aws` adds to `slidesend` (spec §14). Node only: `aws()` loads this
 * module when a command runs, so none of it reaches a browser bundle.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PlatformCommandContext } from "@slidesend/core";

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Imports a module as the talk project would resolve it. */
async function fromProject<T>(projectRoot: string, specifier: string): Promise<T> {
  const require = createRequire(join(projectRoot, "package.json"));
  let resolved: string;
  try {
    resolved = require.resolve(specifier);
  } catch {
    throw new Error(
      `The talk project needs "${specifier.split("/").slice(0, 2).join("/")}": npm install -D it.`,
    );
  }
  return (await import(pathToFileURL(resolved).href)) as T;
}

/** The local control secret the Blocks mocks created, from `.bb-data/settings.json`. */
function localSecret(projectRoot: string): string | undefined {
  const file = join(projectRoot, ".bb-data", "settings.json");
  if (!existsSync(file)) return undefined;
  const settings = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const entry = Object.entries(settings).find(([key]) => key.endsWith("-sd-control"));
  return typeof entry?.[1] === "string" ? entry[1] : undefined;
}

export { bootstrap } from "./bootstrap/command";
export { deploy, destroy, open } from "./deploy/command";
export { workflow } from "./workflow/command";

/**
 * `slidesend dev` on AWS: runs the project's `aws-blocks/index.ts` on the AWS Blocks dev server
 * with its local mocks, with Vite behind it, and prints the desk link with the control secret.
 * Options: `--port <n>` (default 3000; Vite runs on n + 100).
 */
export async function dev(context: PlatformCommandContext): Promise<void> {
  const port = Number(option(context.args, "--port") ?? 3000);
  const frontendPort = port + 100;
  const { register } = await fromProject<{ register(): void }>(context.projectRoot, "tsx/esm/api");
  register();
  const { startDevServer } = await fromProject<{
    startDevServer(options: Record<string, unknown>): Promise<unknown>;
  }>(context.projectRoot, "@aws-blocks/blocks/scripts");
  await startDevServer({
    backendPath: join(context.projectRoot, "aws-blocks", "index.ts"),
    frontendCommand: `VITE_SLIDESEND_PLATFORM=aws npx vite --port ${frontendPort} --strictPort`,
    frontendPort,
    port,
  });
  const url = `http://localhost:${port}`;
  const secret = localSecret(context.projectRoot);
  context.log(`  Desk   ${url}/desk${secret ? `#key=${secret}` : ""}`);
  context.log(`  Phones ${url}/`);
  context.log("  Stage  opened from the desk, or /stage/<sessionId> with the key");
}
