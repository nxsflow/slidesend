# Releasing

Every merge into `main` that carries a changeset with a version bump is a release. Nobody
publishes by hand.

## In a pull request

A pull request that changes what a package ships (anything under `packages/`, tests aside) adds a
changeset:

```sh
pnpm changeset          # pick the packages, patch / minor / major, one sentence for the changelog
pnpm changeset --empty  # the change is invisible to users, and that is a decision
```

The `changeset` job of the check workflow fails without one. All five packages share one version
(`fixed` in `.changeset/config.json`), so a changeset for one package moves all of them.

## What the release workflow does

After every push to `main`, `.github/workflows/release.yml` runs two jobs.

**`prepare`** has read access only, and checks out the newest `main` (not the commit that
triggered it, which may be older by the time a queued run starts). `scripts/release-plan.mjs`:

1. runs `pnpm changeset version` if changesets are pending: new versions, changelogs, the
   changesets consumed;
2. decides: something to **commit** (changesets were consumed), a new version to **tag** (the
   version changed), packages to **publish** (any package is not on npm in this version), and
   the npm dist-tag, taken from the version (`0.2.0-alpha.1` → `alpha`, `1.0.0` → `latest`);
3. writes the release notes from the changelog.

If something is to be published, it runs `pnpm check` on exactly that state. It hands over the
changes as a patch and the built packages as an artifact.

**`release`** runs in the environment `npm`, with write access and the token, and runs no code
of this repository:

1. pushes `chore(release): vX.Y.Z` and the tag `vX.Y.Z` in one atomic push; if `main` moved in
   the meantime, the push fails, nothing is published, and the run of the newer push releases;
2. publishes the five packages to npm with provenance (install and lifecycle scripts off);
3. creates the GitHub release `vX.Y.Z` on the release commit, with the changelog.

A merge without a changeset finds nothing and stops. An empty changeset (`--empty`) is consumed
in a commit `chore(release): consume changesets without a release`: no version, no tag, nothing
published.

## Pre-releases

```sh
pnpm changeset pre enter alpha   # or beta; commit .changeset/pre.json in a pull request
pnpm changeset pre exit          # back to stable releases
```

In pre mode every release is a pre-release of the next version: `0.2.0-alpha.0`, `0.2.0-alpha.1`,
… The tag is `v0.2.0-alpha.1`, npm gets the dist-tag `alpha` (so `npm install` keeps the last
stable version and `@alpha` the newest pre-release), and the GitHub release is marked as a
pre-release. Changing from alpha to beta: `pre exit`, then `pre enter beta`, in one pull request.
In pre mode, Changesets keeps the changesets it has used in `.changeset/pre/`, so that the stable
release can collect them into one changelog entry; they are not pending changesets.

## Access to npm

The workflow runs in the GitHub environment `npm`, which admits only `main`, and reads the secret
`NPM_TOKEN` from it: a granular npm access token that may publish the `@slidesend` packages.

```sh
REPO=nxsflow/slidesend
gh api --method PUT repos/$REPO/environments/npm \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
gh api --method POST repos/$REPO/environments/npm/deployment-branch-policies -f name=main
gh secret set NPM_TOKEN --env npm      # paste the token
```

Once the packages exist on npm, switch to trusted publishing: on npmjs.com, add this repository
and the workflow `release.yml` (environment `npm`) as trusted publisher of each of the five
packages, then delete the token and the secret.

## When a release stops halfway

- **In `prepare`** (the check failed): nothing was pushed. Fix it on `main`; the changesets are
  still there, and that merge releases.
- **The push was rejected** (`main` moved): nothing was published; the run started by the newer
  push releases.
- **After the push, before npm is complete** (publishing failed, or failed for some packages):
  the version is on `main` but not on npm. Fix the cause (e.g. the token) and start the workflow
  by hand (**Actions → release → Run workflow**) — or let the next merge do it: every run
  publishes the packages missing in the current version, skips those already there, tags the
  release commit if the tag is missing, and creates a missing GitHub release.

## Protecting main

The `release` job pushes the release commit with the workflow's own token. That works while
`main` accepts pushes from GitHub Actions. Should `main` get branch protection or a ruleset that
requires pull requests, allow the GitHub Actions app to bypass it, or the release commit is
rejected (and nothing is published). Likewise, the environment `npm` admits only `main`; adding
required reviewers to it turns every release into one more click.
