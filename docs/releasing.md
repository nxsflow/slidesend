# Releasing

Every merge into `main` that carries a changeset is a release. Nobody publishes by hand.

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

After the merge, `.github/workflows/release.yml`:

1. runs `pnpm changeset version`: new versions, changelogs, the changesets consumed;
2. runs `pnpm check` on exactly that state;
3. commits it as `chore(release): vX.Y.Z` to `main` and tags `vX.Y.Z`;
4. publishes the five packages to npm with provenance;
5. creates the GitHub release `vX.Y.Z` with the changelog.

A merge without a changeset finds nothing to version and stops.

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

- **Before the release commit** (the check failed): fix it on `main`; the changesets are still
  there, and the next merge releases.
- **After the commit, before npm** (publishing failed): the version is on `main` but not on npm.
  Fix the cause (e.g. the token) and start the workflow by hand (**Actions → release → Run
  workflow**): it publishes what is missing, skips what is already there, and creates the GitHub
  release.
