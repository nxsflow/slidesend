#!/usr/bin/env node
/**
 * The command behind `npm create @slidesend`. The logic is in create.ts; this file is the
 * terminal: it asks for a name when none was given, runs the package manager and prints.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  nameProblem,
  nextSteps,
  type Options,
  packageManagerOf,
  parseArgs,
  usage,
  writeProject,
} from "./create";

// dist/cli.js sits one folder below the package root, next to template/ and template-aws/.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  version: string;
};

async function askName(options: Options): Promise<string> {
  if (options.name) return options.name;
  if (options.yes || !process.stdin.isTTY) return "my-talk";
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (await terminal.question("Folder name for your talk (my-talk): ")).trim();
      const name = answer || "my-talk";
      const problem = nameProblem(name);
      if (!problem) return name;
      console.log(`  ${problem}`);
    }
  } finally {
    terminal.close();
  }
}

function install(packageManager: string, cwd: string): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(packageManager, ["install"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", () => done(false));
    child.on("close", (code) => done(code === 0));
  });
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage.join("\n"));
    return 0;
  }
  const name = await askName(options);
  const problem = nameProblem(name);
  if (problem) throw new Error(`"${name}": ${problem}`);
  const packageManager = options.packageManager ?? packageManagerOf();
  const plan = {
    name,
    target: resolve(process.cwd(), name),
    aws: options.aws,
    packageManager,
    // Tests point the new project at packed tarballs instead of the registry.
    source: {
      version,
      ...(process.env.SLIDESEND_CREATE_TARBALLS
        ? { tarballs: process.env.SLIDESEND_CREATE_TARBALLS }
        : {}),
    },
    packageRoot,
  };
  console.log(`Creating ./${name}${options.aws ? " (AWS variant)" : ""} …`);
  writeProject(plan);
  let installed = false;
  if (options.install) {
    console.log(`Installing with ${packageManager} …`);
    installed = await install(packageManager, plan.target);
    if (!installed) console.log(`  ${packageManager} install failed; run it again in ./${name}.`);
  }
  console.log(nextSteps(plan, installed).join("\n"));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
