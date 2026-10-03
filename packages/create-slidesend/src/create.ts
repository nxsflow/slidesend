/**
 * `npm create @nxsflow/slidesend [name]`: a new folder with the starter talk, its dependencies
 * installed, and the next steps printed. Everything here is plain Node; the outside world (the
 * terminal, the package manager) comes in as `CreateIo`, so the tests run without either.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** What the command line asked for. */
export interface Options {
  name?: string;
  /** Never ask; take the defaults. */
  yes: boolean;
  install: boolean;
  aws: boolean;
  packageManager?: PackageManager;
  help: boolean;
}

/** Reads `[name] [--yes] [--no-install] [--aws] [--package-manager <pm>]`. */
export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { yes: false, install: true, aws: false, help: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift() as string;
    if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--no-install") options.install = false;
    else if (arg === "--aws") options.aws = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--package-manager" || arg === "--pm") {
      const value = rest.shift();
      if (!isPackageManager(value)) {
        throw new Error(`--package-manager takes npm, pnpm, yarn or bun, not "${value ?? ""}".`);
      }
      options.packageManager = value;
    } else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}. See --help.`);
    else if (options.name)
      throw new Error(`One folder name, please: "${options.name}" or "${arg}".`);
    else options.name = arg;
  }
  return options;
}

const isPackageManager = (value: unknown): value is PackageManager =>
  value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";

/** The package manager that runs this command, from the user agent every one of them sets. */
export function packageManagerOf(userAgent = process.env.npm_config_user_agent): PackageManager {
  const name = userAgent?.split("/")[0];
  return isPackageManager(name) ? name : "npm";
}

/** Why a folder name cannot be used, or `undefined` if it can. */
export function nameProblem(name: string): string | undefined {
  if (!name.trim()) return "The name is empty.";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    return "Use lowercase letters, digits, dots, dashes and underscores, starting with a letter or digit.";
  }
  if (name.length > 100) return "The name is too long.";
  return undefined;
}

/**
 * A short stack id for AWS Blocks: `sd-` and the name. Bucket names are built from it and stop
 * at 63 characters, so it is cut to 16; `slidesend bootstrap` checks the result.
 */
export function stackIdOf(name: string): string {
  const slug = name.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "talk";
  return `sd-${slug}`.slice(0, 16).replace(/-+$/, "");
}

/** Where the dependencies come from: the released version, or local tarballs for tests. */
export interface Source {
  version: string;
  /** A folder with `nxsflow-slidesend-<name>-<version>.tgz`, as `pnpm pack` names them. */
  tarballs?: string;
}

/** What `workspace:*` becomes in the new project. */
export function dependencyOf(name: string, source: Source): string {
  if (!source.tarballs) return `^${source.version}`;
  const file = `${name.replace(/^@/, "").replace("/", "-")}-${source.version}.tgz`;
  return `file:${join(resolve(source.tarballs), file)}`;
}

type Manifest = Record<string, unknown> & {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** The new project's package.json: the template's, the AWS overlay on top, versions filled in. */
export function manifestOf(
  template: Manifest,
  overlay: Manifest | undefined,
  name: string,
  source: Source,
  packageManager: PackageManager,
): Manifest {
  const manifest: Manifest = { ...template, name, version: "0.1.0" };
  for (const section of ["scripts", "dependencies", "devDependencies"] as const) {
    const merged = { ...template[section], ...overlay?.[section] };
    for (const [dependency, version] of Object.entries(merged)) {
      if (version === "workspace:*") merged[dependency] = dependencyOf(dependency, source);
      // pnpm copies a `file:` folder, which would miss the client AWS Blocks generates into it;
      // npm and yarn do not know `link:`.
      if (version === "link:./aws-blocks" && packageManager !== "pnpm") {
        merged[dependency] = "file:./aws-blocks";
      }
    }
    if (Object.keys(merged).length > 0) manifest[section] = merged;
  }
  return manifest;
}

/** The files a template ships but a copy must not take: what installing or building left there. */
const skipped = new Set([
  "node_modules",
  "dist",
  "test-results",
  ".bb-data",
  "package.overlay.json",
]);

function copyTemplate(from: string, to: string) {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => !skipped.has(basename(source)),
  });
}

/** Everything `create` needs to know. */
export interface Plan {
  name: string;
  /** The new folder. */
  target: string;
  aws: boolean;
  packageManager: PackageManager;
  source: Source;
  /** The package's own folder, which holds `template` and `template-aws`. */
  packageRoot: string;
}

/**
 * Writes the starter talk into `plan.target`. Refuses a folder that exists and is not empty,
 * because the person may have typed the name of something they care about.
 */
export function writeProject(plan: Plan): void {
  const { target, packageRoot } = plan;
  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new Error(`${target} already exists and is not empty. Pick another name.`);
  }
  mkdirSync(target, { recursive: true });
  try {
    copyTemplate(join(packageRoot, "template"), target);
    let overlay: Manifest | undefined;
    if (plan.aws) {
      const aws = join(packageRoot, "template-aws");
      copyTemplate(aws, target);
      overlay = JSON.parse(readFileSync(join(aws, "package.overlay.json"), "utf8")) as Manifest;
      writeFileSync(
        join(target, ".blocks", "config.json"),
        `${JSON.stringify({ stackId: stackIdOf(plan.name) }, null, 2)}\n`,
      );
    }
    const template = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as Manifest;
    const manifest = manifestOf(template, overlay, plan.name, plan.source, plan.packageManager);
    writeFileSync(join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    // npm drops a file called .gitignore from every package it publishes, so it ships renamed.
    renameSync(join(target, "_gitignore"), join(target, ".gitignore"));
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
}

/**
 * How a script is run with this package manager, with arguments for the script. pnpm needs
 * `run`: some script names, such as `deploy`, are commands of pnpm itself. npm needs `--` before
 * the script's arguments; the others pass them on as they are.
 */
export function runCommand(packageManager: PackageManager, script: string, args = ""): string {
  const command = packageManager === "yarn" ? `yarn ${script}` : `${packageManager} run ${script}`;
  if (!args) return command;
  return packageManager === "npm" ? `${command} -- ${args}` : `${command} ${args}`;
}

/** The lines printed at the end: how to start the talk and open stage and desk. */
export function nextSteps(plan: Plan, installed: boolean): string[] {
  const run = (script: string, args?: string) => runCommand(plan.packageManager, script, args);
  const exec = plan.packageManager === "npm" ? "npx" : `${plan.packageManager} exec`;
  return [
    "",
    `Your talk is in ./${plan.name}. Next:`,
    "",
    `  cd ${plan.name}`,
    ...(installed ? [] : [`  ${plan.packageManager} install`]),
    `  ${run("dev")}`,
    "",
    plan.aws
      ? "That starts the AWS Blocks dev server with local mocks (no AWS account needed) and prints"
      : "That starts the dev server, with phones allowed to join from your network, and prints",
    "a desk link that ends in #key=… — the key gives that browser control of the talk.",
    "",
    "  1. Open the desk link. The desk shows your notes, the clock and what comes next.",
    "  2. In the desk, Prepare: create a session and open it.",
    "  3. Join → Open the stage: the stage opens in a new window. Put it on the projector.",
    "  4. Phones scan the code on the stage, or open the address under Join.",
    ...(plan.aws
      ? []
      : [
          "     Open the desk with your network address instead of localhost, so phones can reach it.",
        ]),
    "",
    "Then read src/deck.ts next to the talk: the talk explains how it is made.",
    `For \`${run("check:render")}\` and \`${run("pdf")}\`, run \`${exec} playwright install chromium\` once.`,
    ...(plan.aws
      ? [
          "",
          "To put it online: node_modules/@nxsflow/slidesend-aws/docs/deploy-aws.md",
          `(sign in with an AWS profile, then \`${run("deploy", "--profile <name>")}\`).`,
        ]
      : []),
    "",
  ];
}

/** The usage text of `--help`. */
export const usage = [
  "Usage: npm create @nxsflow/slidesend [name] [options]",
  "",
  "Creates ./<name> with a Slidesend talk that explains how it is made, and installs it.",
  "",
  "Options:",
  "  --aws                      the variant that deploys to AWS (otherwise local only)",
  "  --yes, -y                  ask nothing; the name defaults to my-talk",
  "  --no-install               write the files, install nothing",
  "  --package-manager <pm>     npm, pnpm, yarn or bun (default: the one running this)",
  "  --help, -h                 this text",
];
