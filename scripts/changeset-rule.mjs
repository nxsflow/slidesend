/**
 * When a pull request needs a changeset: whenever it changes what a published package ships.
 * Releases come from changesets (docs/releasing.md), so a package change without one would
 * never reach npm. A change that users do not see still gets one, an empty one
 * (`pnpm changeset --empty`), so that leaving it out is a decision, not an oversight.
 */

/** Files of a published package: anything under packages/<name>/ except tests. */
export function shipsInAPackage(file) {
  if (!/^packages\/[^/]+\//.test(file)) return false;
  return !/\.test\.(ts|tsx|mjs)$/.test(file) && !/\/(test|tests|e2e)\//.test(file);
}

/** A changeset the pull request adds: a Markdown file in .changeset/ other than its README. */
export function isChangeset(file) {
  return /^\.changeset\/[^/]+\.md$/.test(file) && file !== ".changeset/README.md";
}

/** The sentence to fail with, or `undefined` when the pull request is fine. */
export function changesetProblem(changedFiles) {
  const shipped = changedFiles.filter(shipsInAPackage);
  if (shipped.length === 0 || changedFiles.some(isChangeset)) return undefined;
  return [
    `This pull request changes what the packages ship (${shipped.slice(0, 3).join(", ")}${shipped.length > 3 ? ", …" : ""}) but adds no changeset.`,
    "Run `pnpm changeset` and describe the change for the changelog, or `pnpm changeset --empty` if users will not notice it.",
  ].join("\n");
}
