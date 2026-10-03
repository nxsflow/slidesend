#!/usr/bin/env node
/**
 * What a run of the release workflow does (docs/releasing.md), decided in one tested place:
 * version the pending changesets, then work out whether there is something to commit, a new
 * version to tag, and packages to publish — and with which npm dist-tag and release notes.
 *
 * Run by the read-only `prepare` job. It writes its decisions to $GITHUB_OUTPUT and the release
 * notes to release/notes.md; the `release` job acts on them.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The npm dist-tag of a version: its prerelease id (`0.2.0-alpha.3` → `alpha`), or `latest`.
 * Read from the version itself, not from the pre mode: a version cut in pre mode stays a
 * pre-release even when it is published after `changeset pre exit`.
 */
export function distTagOf(version) {
  const prerelease = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)(?:\.[0-9A-Za-z.-]+)?$/.exec(version);
  if (prerelease) return prerelease[1];
  if (/^\d+\.\d+\.\d+$/.test(version)) return "latest";
  throw new Error(`"${version}" is not a version this workflow knows how to tag.`);
}

/** The changelog section of `version`, without its heading. Throws if there is none. */
export function notesOf(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start < 0) throw new Error(`The changelog has no section "## ${version}".`);
  const length = lines.slice(start + 1).findIndex((line) => line.startsWith("## "));
  const body = lines.slice(start + 1, length < 0 ? undefined : start + 1 + length);
  return `${body.join("\n").trim()}\n`;
}

/** The pending changesets among the files of `.changeset/` (its top level only). */
export function pendingChangesets(files) {
  return files.filter((file) => file.endsWith(".md") && file !== "README.md");
}

/**
 * Whether a version is on npm, from the result of `npm view <name>@<version> version`. Anything
 * but "found" or "not found" is an error: a network failure must not read as "not published".
 */
export function npmState(result) {
  if (result.status === 0 && result.stdout.trim()) return "published";
  if (/E404|404 Not Found/.test(result.stderr) || (result.status === 0 && !result.stdout.trim())) {
    return "missing";
  }
  throw new Error(`npm could not be asked: ${result.stderr.trim() || `exit ${result.status}`}`);
}

/** The run's decisions, from what it found. */
export function planOf({ before, after, dirty, missing }) {
  return {
    version: after,
    distTag: distTagOf(after),
    // An empty changeset is consumed without a new version: commit that, tag nothing.
    commit: dirty,
    tag: before !== after,
    publish: after !== "0.0.0" && missing.length > 0,
  };
}

const run = (command, args) => spawnSync(command, args, { encoding: "utf8" });

function packages(root) {
  const folder = join(root, "packages");
  return readdirSync(folder)
    .map((name) => JSON.parse(readFileSync(join(folder, name, "package.json"), "utf8")))
    .filter((manifest) => !manifest.private);
}

function main() {
  const root = process.cwd();
  const versionOf = () =>
    JSON.parse(readFileSync(join(root, "packages", "core", "package.json"), "utf8")).version;
  const before = versionOf();
  const pending = pendingChangesets(readdirSync(join(root, ".changeset")));
  if (pending.length > 0) {
    console.log(`Versioning ${pending.length} changeset(s): ${pending.join(", ")}`);
    const versioned = spawnSync("pnpm", ["changeset", "version"], { stdio: "inherit" });
    if (versioned.status !== 0) throw new Error("pnpm changeset version failed.");
  }
  const after = versionOf();
  const dirty = run("git", ["status", "--porcelain"]).stdout.trim() !== "";
  const missing = packages(root)
    .filter(
      (manifest) =>
        npmState(run("npm", ["view", `${manifest.name}@${after}`, "version"])) === "missing",
    )
    .map((manifest) => manifest.name);
  const plan = planOf({ before, after, dirty, missing });

  mkdirSync(join(root, "release"), { recursive: true });
  if (plan.tag || plan.publish) {
    const changelog = readFileSync(join(root, "packages", "core", "CHANGELOG.md"), "utf8");
    writeFileSync(join(root, "release", "notes.md"), notesOf(changelog, plan.version));
  }
  console.log(
    `v${plan.version} (dist-tag ${plan.distTag}): commit ${plan.commit}, tag ${plan.tag}, publish ${plan.publish}` +
      (missing.length > 0 ? ` — not on npm: ${missing.join(", ")}` : ""),
  );
  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries({
      version: plan.version,
      "dist-tag": plan.distTag,
      commit: plan.commit,
      tag: plan.tag,
      publish: plan.publish,
    }).map(([key, value]) => `${key}=${value}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
