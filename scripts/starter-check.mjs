#!/usr/bin/env node
/**
 * Creates the starter talk the way a user would, and checks it (spec §15, bn5g): the packages
 * are packed, the create command runs from its own tarball (so `files` is tested too), and the
 * talk it writes is installed, type-checked, rendered step by step and built — once as the
 * local variant with npm, once as the AWS variant with pnpm. The template cannot drift from the
 * packages without this failing.
 *
 * Needs the packages built (`pnpm build`) and Playwright's Chromium installed.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const packages = [
  "slidesend-core",
  "slidesend-basics",
  "slidesend-aws",
  "slidesend-agent",
  "create-slidesend",
];
const variants = [
  { name: "starter-local", packageManager: "npm", aws: false },
  { name: "starter-aws", packageManager: "pnpm", aws: true },
];

const scratch = mkdtempSync(join(tmpdir(), "sd-starter-"));
const packs = join(scratch, "packs");
mkdirSync(packs);

/** Runs a command, prints it, and stops everything if it fails. */
function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}${options.cwd ? `   (in ${options.cwd})` : ""}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    console.error(`\nThe starter check failed; the files are in ${scratch}.`);
    process.exit(1);
  }
}

for (const name of packages) {
  run("pnpm", ["pack", "--pack-destination", packs], { cwd: join(root, "packages", name) });
}
const { version } = JSON.parse(
  readFileSync(join(root, "packages", "create-slidesend", "package.json"), "utf8"),
);
const create = join(scratch, "create");
mkdirSync(create);
run("tar", ["-xzf", join(packs, `nxsflow-create-slidesend-${version}.tgz`), "-C", create]);
const cli = join(create, "package", "dist", "cli.js");

for (const variant of variants) {
  const { name, packageManager, aws } = variant;
  run(
    process.execPath,
    [cli, name, "--yes", "--package-manager", packageManager, ...(aws ? ["--aws"] : [])],
    // Outside this workspace, so the new talk installs like any other project.
    { cwd: scratch, env: { SLIDESEND_CREATE_TARBALLS: packs } },
  );
  const talk = join(scratch, name);
  run(packageManager, ["run", "typecheck"], { cwd: talk });
  run(packageManager, ["run", "check:render"], { cwd: talk });
  run(packageManager, ["run", "build"], {
    cwd: talk,
    // What `slidesend deploy` sets for the AWS build.
    env: aws ? { VITE_SLIDESEND_PLATFORM: "aws" } : {},
  });
}

rmSync(scratch, { recursive: true, force: true });
console.log("\nThe starter talk was created, installed, checked and built in both variants.");
