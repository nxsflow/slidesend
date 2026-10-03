/**
 * `slidesend workflow`: writes the deploy workflow into the talk's repository, generated for
 * where the talk sits in it and how the repository checks itself.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { PlatformCommandContext } from "@nxsflow/slidesend-core";
import { deployWorkflow, type WorkflowInput } from "./template";

/** The files the command reads and the one it writes. */
export interface WorkflowIo {
  read(path: string): string | undefined;
  exists(path: string): boolean;
  write(path: string, content: string): void;
}

export const nodeWorkflowIo: WorkflowIo = {
  read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined),
  exists: existsSync,
  write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
};

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/** The repository root: the nearest folder above the talk that holds `.git`. */
export function repositoryRootOf(projectRoot: string, io: WorkflowIo): string | undefined {
  let folder = projectRoot;
  for (;;) {
    if (io.exists(join(folder, ".git"))) return folder;
    const parent = dirname(folder);
    if (parent === folder) return undefined;
    folder = parent;
  }
}

const scriptsOf = (manifest: string | undefined): Record<string, string> => {
  try {
    return (JSON.parse(manifest ?? "{}") as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    return {};
  }
};

/** What the generator needs, read from the repository. */
export function workflowInputOf(
  projectRoot: string,
  repositoryRoot: string,
  io: WorkflowIo,
  args: readonly string[] = [],
): WorkflowInput {
  const rootManifest = io.read(join(repositoryRoot, "package.json"));
  const talkManifest = io.read(join(projectRoot, "package.json")) ?? "";
  const rootCheck = projectRoot !== repositoryRoot && "check" in scriptsOf(rootManifest);
  return {
    talkDir: relative(repositoryRoot, projectRoot),
    packageManager: io.exists(join(repositoryRoot, "pnpm-lock.yaml")) ? "pnpm" : "npm",
    rootCheck,
    playwright: rootCheck && talkManifest.includes('"@playwright/test"'),
    ...(io.exists(join(repositoryRoot, ".nvmrc")) ? { nodeVersionFile: ".nvmrc" } : {}),
    environment: option(args, "--environment") ?? "production",
    branch: option(args, "--branch") ?? "main",
  };
}

/** Writes `.github/workflows/deploy.yml`; refuses to overwrite one unless `--force` is given. */
export async function workflow(context: PlatformCommandContext, io: WorkflowIo = nodeWorkflowIo) {
  const root = repositoryRootOf(context.projectRoot, io);
  if (!root) throw new Error("The talk is not in a git repository; run `git init` first.");
  const target = join(root, ".github", "workflows", "deploy.yml");
  if (io.exists(target) && !context.args.includes("--force")) {
    throw new Error(
      `${relative(root, target)} exists already; pass --force to replace it with the generated one.`,
    );
  }
  io.write(target, deployWorkflow(workflowInputOf(context.projectRoot, root, io, context.args)));
  context.log(`  Wrote ${relative(root, target)}.`);
  context.log(
    "  It needs the GitHub environment and the two secrets `slidesend bootstrap` checks.",
  );
}
