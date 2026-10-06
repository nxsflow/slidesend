# Continuous deployment

Every push to the talk's main branch checks the talk and deploys it to AWS from GitHub Actions.
No access key exists anywhere: the job signs in through OpenID Connect (OIDC) and assumes a
deploy role whose trust policy admits only this repository, in one GitHub environment, which in
turn admits only one branch.

Start from a talk that deploys from your machine ([deploy-aws](deploy-aws.md)) and lives in a
GitHub repository. You also need the GitHub CLI, signed in (`gh auth login`).

## How the pieces fit

```text
push to main
  └─ GitHub environment "production"   admits only the branch main
       └─ OIDC token, subject repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:production
            └─ IAM role <stackId>-deploy   trusts exactly that subject
                 └─ CDK deploy roles        create and update <stackId>-prod
```

Repositories with immutable subjects turned off get `repo:<owner>/<repo>:environment:production`
instead; `slidesend bootstrap` reads which one applies.

The bootstrap stack `<stackId>-bootstrap` holds the account's GitHub OIDC provider, the deploy
role and, for a custom domain, the hosted zone. An account holds only one provider for GitHub, so
the first talk's bootstrap stack creates it and every later talk in the same account imports it;
`slidesend bootstrap` decides which. Delete the first talk's bootstrap stack and the provider goes
with it, which locks the other talks out until one of them runs `slidesend bootstrap --deploy`
again. It is separate from
the talk's stack and survives `slidesend destroy`. The deploy role may only assume the CDK
bootstrap roles and read the CDK bootstrap version; everything else happens through CDK.

## 1. The GitHub environment

Environments are available on public repositories, and on private ones with a paid GitHub plan;
`slidesend bootstrap` says so when a private repository on GitHub Free has none. Create
`production` with a rule that admits only `main` (this is also the remedy `slidesend bootstrap`
prints):

```sh
REPO=<owner>/<repo>
gh api --method PUT repos/$REPO/environments/production \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
gh api --method POST repos/$REPO/environments/production/deployment-branch-policies \
  -f name=main
```

The branch rule matters: with `environment:` in the job, GitHub leaves the branch out of the OIDC
subject, so the trust policy cannot check it. The environment does.

## 2. The secrets

The workflow reads two secrets of that environment. The role does not exist yet, but its name is
fixed: `<stackId>-deploy`, in the account you deploy to.

```sh
gh secret set AWS_DEPLOY_ROLE --env production --body arn:aws:iam::<account-id>:role/<stackId>-deploy
gh secret set AWS_REGION --env production --body eu-central-1
```

## 3. Bootstrap

```sh
pnpm exec slidesend bootstrap --profile my-talk
```

checks every precondition and changes nothing:

```text
  ok    AWS profile is signed in: Account 111122223333 as arn:aws:sts::…
  ok    region is known: eu-central-1
  ok    the account is CDK-bootstrapped: …
  ok    GitHub repository and its immutable ids: …
  ok    the GitHub environment restricts the branch: "production" admits main
  ok    the deploy secrets are set: AWS_DEPLOY_ROLE and AWS_REGION in "production"
  ok    esbuild is a dependency of the workspace root: …
  ok    .blocks/config.json names the stack: …
  ok    the GitHub OIDC provider is created or imported: none yet; the bootstrap stack creates it
  ok    bucket names stay within 63 characters: …

  Everything is in place.
Run `slidesend bootstrap --deploy` to create the OIDC provider and the role.
```

Anything marked `TODO` comes with the command that fixes it. When everything is in place:

```sh
pnpm exec slidesend bootstrap --deploy --profile my-talk
```

deploys `<stackId>-bootstrap` and prints the role's ARN, which must match the secret from step 2,
and, for a custom domain, the name servers to delegate the domain to. `--environment <name>`,
`--branch <name>` and `--role <name>` change the defaults `production`, `main` and
`<stackId>-deploy`; pass the same `--environment` and `--branch` to `slidesend workflow`.

The trust policy is built from the repository's **immutable ids**, which `slidesend bootstrap`
reads from GitHub. Renaming the repository keeps them; transferring it to another owner changes
the owner id, and then `slidesend bootstrap --deploy` must run again.

## 4. The workflow

```sh
pnpm exec slidesend workflow
```

writes `.github/workflows/deploy.yml`, fitted to the repository: where the talk sits; pnpm
(by `pnpm-lock.yaml`) or otherwise npm; `.nvmrc` at the root (otherwise Node 24); and, for a talk
in a subfolder, whether the root has its own `check` script, which then gates the deploy (with
Playwright installed first if the talk uses it). Otherwise `slidesend check` does. `--force` overwrites an existing file. The
workflow of the Slidesend repository itself, for its example talk:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    environment: production
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
        working-directory: examples/gravity
      - run: pnpm check
      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: ${{ secrets.AWS_REGION }}
          role-duration-seconds: 7200
      - run: pnpm exec slidesend deploy --region ${{ secrets.AWS_REGION }}
        working-directory: examples/gravity
```

It also runs on `workflow_dispatch`, has `id-token: write` for OIDC, and never runs two deploys
at once nor cancels one halfway. Every action runs on Node.js 24 and is pinned to the commit of
its release, with the version as a comment: a tag can be moved to other code, a commit cannot.
To keep them current, add `.github/dependabot.yml` to the talk's repository:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

Commit the workflow and push. The run's log ends with the site's address only:

```text
  Site   https://d1234abcd.cloudfront.net/
  The desk link carries the control secret, so it is not printed here: run `slidesend open` where you are signed in.
```

A CI log may be public, so `slidesend deploy` never prints the control secret there. Run
`pnpm exec slidesend open --profile my-talk` on your machine for the desk link.

## Troubleshooting

### `Not authorized to perform sts:AssumeRoleWithWebIdentity`

The job could not assume the deploy role. Two very different causes produce this same message:

1. **The trust policy does not match the token**: a different environment name, a run from a
   branch the environment does not admit, a repository that moved to another owner, a role
   deployed for another repository.
2. **An organization policy denies it**: a service control policy (SCP) or a resource control
   policy in AWS Organizations, e.g. one that denies regions outside an allow-list.

Only AWS CloudTrail tells them apart. Look up the failed calls in the deploy region:

```sh
aws cloudtrail lookup-events --profile my-talk --region eu-central-1 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --max-results 5 --query 'Events[].CloudTrailEvent' --output text \
  | jq '{time: .eventTime, error: .errorCode, message: .errorMessage, subject: .userIdentity.userName}'
```

- The `subject` is what GitHub sent. Compare it with the condition
  `token.actions.githubusercontent.com:sub` in the role's trust policy
  (`aws iam get-role --role-name <stackId>-deploy`). If they differ, fix the environment or run
  `slidesend bootstrap --deploy` again.
- If the message mentions a **service control policy** or an **explicit deny**, the trust policy
  is fine; ask whoever administers the organization to exempt the role or the region.
- No event at all means the request never reached this account and region: check the
  `AWS_DEPLOY_ROLE` and `AWS_REGION` secrets.

### Other failures

| Symptom | Cause and fix |
|---|---|
| The job waits or fails with "branch not allowed to deploy" | The environment's branch rule does not admit the branch; see step 1. |
| `Credentials could not be loaded` | The job lacks `id-token: write`; regenerate the workflow. |
| The deploy stops after an hour with expired credentials | The role allows two hours; keep `role-duration-seconds: 7200` and the job's timeout below it. |
| The deploy fails, the stack is in `UPDATE_ROLLBACK_…` | Wait for the rollback to finish, then run the workflow again; the concurrency group prevents overlapping runs. |
| `The talk cannot be deployed yet. Missing: …` | A dev dependency is missing from the talk's `package.json`; see [deploy-aws](deploy-aws.md#packages). |
