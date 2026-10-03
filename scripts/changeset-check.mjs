#!/usr/bin/env node
/**
 * Fails a pull request that changes a published package without a changeset; see
 * changeset-rule.mjs. Deleted files do not count: a pull request that deletes a changeset has
 * not added one.
 */
import { execFileSync } from "node:child_process";
import { changesetProblem } from "./changeset-rule.mjs";

const base = process.argv[2] ?? "origin/main";
const changed = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`],
  {
    encoding: "utf8",
  },
)
  .split("\n")
  .filter(Boolean);
const problem = changesetProblem(changed);
if (problem) {
  console.error(problem);
  process.exit(1);
}
console.log("Changesets: fine.");
