/**
 * The preconditions of a first deployment (spec §14), each verified before it can hurt.
 *
 * Every one of these has a failure mode that costs an hour to diagnose and a minute to fix once
 * named: an expired SSO session, an account without a CDK bootstrap, a trust policy that matches
 * no token, a secret nobody set, a bucket name one character too long. So the checks run in the
 * order in which the setup happens, each names the exact command that fixes it, and the whole
 * thing touches nothing: it only reads.
 *
 * The outside world arrives as one injected object, so every check is unit-tested against a
 * scripted terminal rather than an AWS account.
 */
import { cdkQualifier } from "../infra/bootstrap-stack";
import type { Repository } from "../infra/subject";

/** What running a program gave back. */
export interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

/** The outside world a check may touch: programs it runs, files it reads. Both read-only. */
export interface BootstrapIo {
  /** Runs a program and waits; a missing program is a non-zero status, never a throw. */
  run(command: string, args: readonly string[]): Promise<Run>;
  /** Reads a file by absolute path, or `undefined` when it is not there. */
  read(path: string): string | undefined;
}

/** What the person asked for on the command line, plus where the talk lives. */
export interface BootstrapPlan {
  /** The talk project's folder. */
  projectRoot: string;
  /** The workspace root; `esbuild` must be a dependency there, not in the talk package. */
  workspaceRoot: string;
  /** The AWS profile to use, if the person named one. */
  profile?: string;
  /** The region the talk deploys to; `--region`, else the profile's. */
  region?: string;
  /** The GitHub environment the deploy job runs in. */
  environment: string;
  /** The branch that environment admits, the one the workflow deploys from. */
  branch: string;
  /** The deploy role's name. */
  roleName: string;
  /** A custom domain, if the talk has one. */
  domain?: string;
}

/** What the checks learned on the way; the CDK app is built from this. */
export interface Facts {
  account?: string;
  region?: string;
  repository?: Repository;
  /** Whether the repository is private, which decides whether GitHub Free has environments. */
  private?: boolean;
  /** Whether the owner is a user or an organization, which decides where its plan is read. */
  ownerType?: "User" | "Organization";
  /** Whether GitHub puts the numeric ids into the subject of this repository's tokens. */
  immutableSubject?: boolean;
  stackId?: string;
  /** An OIDC provider the account already has. */
  providerArn?: string;
}

/** The outcome of one check: either it holds, or it names what to do about it. */
export interface Finding {
  ok: boolean;
  /** One line: what is true, or what is missing. */
  detail: string;
  /** The exact command or step that fixes it. Present whenever `ok` is false. */
  fix?: string;
}

/** One precondition. */
export interface Check {
  /** Short id, also the name in `--only`. */
  id: string;
  /** What it checks, for the terminal. */
  title: string;
  run(io: BootstrapIo, plan: BootstrapPlan, facts: Facts): Promise<Finding>;
}

const json = (run: Run): unknown => {
  try {
    return JSON.parse(run.stdout) as unknown;
  } catch {
    return undefined;
  }
};

/** `aws` with the profile the person named, so no check silently uses a different account. */
function aws(plan: BootstrapPlan, args: readonly string[]): readonly string[] {
  return plan.profile ? [...args, "--profile", plan.profile] : args;
}

const signedIn: Check = {
  id: "profile",
  title: "AWS profile is signed in",
  async run(io, plan, facts) {
    const result = await io.run(
      "aws",
      aws(plan, ["sts", "get-caller-identity", "--output", "json"]),
    );
    const identity = json(result) as { Account?: string; Arn?: string } | undefined;
    if (result.status !== 0 || !identity?.Account) {
      return {
        ok: false,
        detail: `No AWS identity${plan.profile ? ` for profile ${plan.profile}` : ""}.`,
        fix: plan.profile
          ? `aws sso login --profile ${plan.profile}   (or aws configure --profile ${plan.profile})`
          : "aws sso login   (or pass --profile <name>)",
      };
    }
    facts.account = identity.Account;
    return { ok: true, detail: `Account ${identity.Account} as ${identity.Arn ?? "?"}.` };
  },
};

const hasRegion: Check = {
  id: "region",
  title: "region is known",
  async run(io, plan, facts) {
    const named =
      plan.region ?? (await io.run("aws", aws(plan, ["configure", "get", "region"]))).stdout.trim();
    if (!/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(named)) {
      return {
        ok: false,
        detail: named ? `"${named}" is not a region.` : "No region configured.",
        fix: "slidesend bootstrap --region eu-central-1",
      };
    }
    facts.region = named;
    return { ok: true, detail: named };
  },
};

const cdkBootstrapped: Check = {
  id: "cdk",
  title: "the account is CDK-bootstrapped",
  async run(io, plan, facts) {
    const account = facts.account ?? "<account>";
    // A custom domain needs us-east-1 as well: the certificate CloudFront serves can only live
    // there, and its stack is bootstrapped separately from the talk's own region.
    const regions = [facts.region ?? "", ...(plan.domain ? ["us-east-1"] : [])].filter(
      (region, index, all) => region && all.indexOf(region) === index,
    );
    if (regions.length === 0) {
      return { ok: false, detail: "Unknown region.", fix: "Fix the check above." };
    }
    const versions: string[] = [];
    for (const region of regions) {
      const result = await io.run(
        "aws",
        aws(plan, [
          "ssm",
          "get-parameter",
          "--name",
          `/cdk-bootstrap/${cdkQualifier}/version`,
          "--region",
          region,
          "--output",
          "json",
        ]),
      );
      const value = (json(result) as { Parameter?: { Value?: string } } | undefined)?.Parameter
        ?.Value;
      const version = Number(value);
      if (result.status !== 0 || !Number.isFinite(version)) {
        return {
          ok: false,
          detail: `No CDK bootstrap in ${region}.`,
          fix: `npx cdk bootstrap aws://${account}/${region}`,
        };
      }
      // Blocks deploys with a modern bootstrap; an old one fails late, inside the first deploy.
      if (version < 21) {
        return {
          ok: false,
          detail: `CDK bootstrap version ${version} in ${region} is too old.`,
          fix: `npx cdk bootstrap aws://${account}/${region}`,
        };
      }
      versions.push(`${region} version ${version}`);
    }
    return { ok: true, detail: versions.join(", ") };
  },
};

const repositoryIds: Check = {
  id: "repository",
  title: "GitHub repository and its immutable ids",
  async run(io, _plan, facts) {
    const view = await io.run("gh", [
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "-q",
      ".nameWithOwner",
    ]);
    const nameWithOwner = view.stdout.trim();
    if (view.status !== 0 || !nameWithOwner.includes("/")) {
      return {
        ok: false,
        detail: "Could not ask GitHub which repository this is.",
        fix: "gh auth login   (and run this inside the talk's repository)",
      };
    }
    const api = await io.run("gh", ["api", `repos/${nameWithOwner}`]);
    const data = json(api) as
      | {
          id?: number;
          name?: string;
          private?: boolean;
          owner?: { login?: string; id?: number; type?: "User" | "Organization" };
        }
      | undefined;
    if (api.status !== 0 || !data?.id || !data.owner?.id) {
      return {
        ok: false,
        detail: `GitHub did not answer for ${nameWithOwner}.`,
        fix: "gh auth login",
      };
    }
    facts.repository = {
      owner: data.owner.login ?? nameWithOwner.split("/")[0] ?? "",
      ownerId: data.owner.id,
      name: data.name ?? nameWithOwner.split("/")[1] ?? "",
      id: data.id,
    };
    facts.private = data.private === true;
    if (data.owner.type) facts.ownerType = data.owner.type;
    // The subject form is read, not assumed: with immutable subjects GitHub appends the ids, and
    // a policy written for the wrong form matches no token at all.
    const sub = await io.run("gh", [
      "api",
      `repos/${nameWithOwner}/actions/oidc/customization/sub`,
    ]);
    const customization = json(sub) as
      | { use_default?: boolean; use_immutable_subject?: boolean }
      | undefined;
    facts.immutableSubject = customization?.use_immutable_subject !== false;
    return {
      ok: true,
      detail: `${nameWithOwner} (owner ${data.owner.id}, repo ${data.id})${
        facts.immutableSubject ? ", immutable subject" : ", subject without ids"
      }`,
    };
  },
};

/**
 * The one-step remedy for an environment without a usable branch rule: a custom branch policy
 * that names the deployment branch. `protected_branches` would be shorter, but it admits no
 * branch at all while the branch has no protection rule — the common case for a talk.
 */
export function environmentRemedy(slug: string, environment: string, branch: string): string {
  return [
    `gh api --method PUT repos/${slug}/environments/${environment}`,
    `-F "deployment_branch_policy[protected_branches]=false"`,
    `-F "deployment_branch_policy[custom_branch_policies]=true"`,
    `&& ${branchPolicyRemedy(slug, environment, branch)}`,
  ].join(" ");
}

/** Adds the deployment branch to an environment that already has custom branch policies. */
export function branchPolicyRemedy(slug: string, environment: string, branch: string): string {
  return `gh api --method POST repos/${slug}/environments/${environment}/deployment-branch-policies -f name=${branch}`;
}

/** The plan of the repository's owner, if GitHub tells this login; `undefined` if it does not. */
async function ownerPlan(io: BootstrapIo, facts: Facts): Promise<string | undefined> {
  const owner = facts.repository?.owner;
  if (!owner) return undefined;
  const path = facts.ownerType === "Organization" ? `orgs/${owner}` : "user";
  const data = json(await io.run("gh", ["api", path])) as
    | { login?: string; plan?: { name?: string } }
    | undefined;
  // `user` is whoever is signed in; its plan says nothing about somebody else's repository.
  if (path === "user" && data?.login !== owner) return undefined;
  return data?.plan?.name;
}

const environmentExists: Check = {
  id: "environment",
  title: "the GitHub environment restricts the branch",
  async run(io, plan, facts) {
    const repository = facts.repository;
    if (!repository)
      return { ok: false, detail: "Unknown repository.", fix: "Fix the check above." };
    const slug = `${repository.owner}/${repository.name}`;
    const { environment, branch } = plan;
    const result = await io.run("gh", ["api", `repos/${slug}/environments/${environment}`]);
    if (result.status !== 0) {
      // A private repository on GitHub Free has no environments at all, and the PUT below would
      // fail as well. Say so instead of handing out a command that cannot work.
      if (facts.private && (await ownerPlan(io, facts)) === "free") {
        return {
          ok: false,
          detail: `${slug} is private, and private repositories on GitHub Free have no environments.`,
          fix:
            `Make it public (gh repo edit ${slug} --visibility public ` +
            "--accept-visibility-change-consequences) or move its owner to a paid plan, then run " +
            "`slidesend bootstrap` again.",
        };
      }
      return {
        ok: false,
        detail: `The repository has no environment "${environment}".`,
        fix: environmentRemedy(slug, environment, branch),
      };
    }
    const data = json(result) as
      | {
          deployment_branch_policy?: {
            protected_branches?: boolean;
            custom_branch_policies?: boolean;
          } | null;
        }
      | undefined;
    const policy = data?.deployment_branch_policy;
    // The trust policy carries no branch — with `environment:` in the job, GitHub drops the ref
    // from the subject. This rule is what keeps a deploy to the branch you meant.
    if (!policy || (!policy.protected_branches && !policy.custom_branch_policies)) {
      return {
        ok: false,
        detail: `"${environment}" accepts a deployment from any branch.`,
        fix: environmentRemedy(slug, environment, branch),
      };
    }
    if (policy.protected_branches) {
      const found = json(await io.run("gh", ["api", `repos/${slug}/branches/${branch}`])) as
        | { protected?: boolean }
        | undefined;
      if (found?.protected) {
        return { ok: true, detail: `"${environment}" admits protected branches; ${branch} is one` };
      }
      return {
        ok: false,
        detail: `"${environment}" admits only protected branches, and ${branch} is not protected, so no deployment can run.`,
        fix: environmentRemedy(slug, environment, branch),
      };
    }
    const policies = json(
      await io.run("gh", [
        "api",
        `repos/${slug}/environments/${environment}/deployment-branch-policies`,
      ]),
    ) as { branch_policies?: { name?: string; type?: string }[] } | undefined;
    const names = (policies?.branch_policies ?? [])
      .filter((entry) => (entry.type ?? "branch") === "branch")
      .map((entry) => entry.name);
    if (names.includes(branch)) {
      return { ok: true, detail: `"${environment}" admits ${branch}` };
    }
    return {
      ok: false,
      detail: `"${environment}" does not admit ${branch}${names.length > 0 ? ` (only ${names.join(", ")})` : ""}.`,
      fix: branchPolicyRemedy(slug, environment, branch),
    };
  },
};

const secretsSet: Check = {
  id: "secrets",
  title: "the deploy secrets are set",
  async run(io, plan, facts) {
    const repository = facts.repository;
    if (!repository)
      return { ok: false, detail: "Unknown repository.", fix: "Fix the check above." };
    const slug = `${repository.owner}/${repository.name}`;
    const result = await io.run("gh", [
      "secret",
      "list",
      "--env",
      plan.environment,
      "--json",
      "name",
    ]);
    const names = new Set(
      ((json(result) as { name?: string }[] | undefined) ?? []).map((entry) => entry.name),
    );
    const missing = ["AWS_DEPLOY_ROLE", "AWS_REGION"].filter((name) => !names.has(name));
    if (result.status !== 0 || missing.length > 0) {
      const arn = `arn:aws:iam::${facts.account ?? "<account>"}:role/${plan.roleName}`;
      return {
        ok: false,
        detail: `Missing in "${plan.environment}": ${missing.join(", ") || "all secrets"}.`,
        fix:
          `gh secret set AWS_DEPLOY_ROLE --env ${plan.environment} --body ${arn} && ` +
          `gh secret set AWS_REGION --env ${plan.environment} --body ${facts.region ?? "<region>"}` +
          `   (the role exists after the bootstrap deploy; ${slug})`,
      };
    }
    return { ok: true, detail: `AWS_DEPLOY_ROLE and AWS_REGION in "${plan.environment}"` };
  },
};

const esbuildInRoot: Check = {
  id: "esbuild",
  title: "esbuild is a dependency of the workspace root",
  async run(io, plan) {
    const raw = io.read(`${plan.workspaceRoot}/package.json`);
    const manifest = raw
      ? (JSON.parse(raw) as { dependencies?: object; devDependencies?: object })
      : undefined;
    const present =
      "esbuild" in (manifest?.dependencies ?? {}) || "esbuild" in (manifest?.devDependencies ?? {});
    if (!present) {
      // Blocks bundles the backend with the root's esbuild; without it the deploy fails deep
      // inside the bundling step, with an error that names neither esbuild nor the root.
      return {
        ok: false,
        detail: "The workspace root has no esbuild.",
        fix: "pnpm add -Dw esbuild   (npm: npm install -D esbuild in the root package)",
      };
    }
    return { ok: true, detail: "present" };
  },
};

const stackIdSet: Check = {
  id: "stackId",
  title: ".blocks/config.json names the stack",
  async run(io, plan, facts) {
    const raw = io.read(`${plan.projectRoot}/.blocks/config.json`);
    const stackId = raw ? (JSON.parse(raw) as { stackId?: string }).stackId : undefined;
    if (!stackId) {
      return {
        ok: false,
        detail: ".blocks/config.json has no stackId.",
        fix: 'Add {"stackId": "sd-<talk>"} to .blocks/config.json and commit it.',
      };
    }
    if (!/^[a-z][a-z0-9-]*$/.test(stackId)) {
      return {
        ok: false,
        detail: `stackId "${stackId}" is not lowercase letters, digits and dashes.`,
        fix: 'Rename it, e.g. {"stackId": "sd-gravity"}.',
      };
    }
    facts.stackId = stackId;
    return { ok: true, detail: stackId };
  },
};

/** The issuer every GitHub Actions token names; an account holds one provider for it. */
const githubIssuer = "token.actions.githubusercontent.com";

/**
 * The account's GitHub OIDC provider, if it has one, and whether this talk may import it.
 *
 * An account can hold only one provider per issuer, so a second talk must import the first one's
 * instead of creating its own. But a provider this talk's own bootstrap stack created must stay
 * created by it: importing it would remove the resource from the stack, and CloudFormation would
 * delete the provider that every deploy of the account trusts.
 */
const oidcProvider: Check = {
  id: "provider",
  title: "the GitHub OIDC provider is created or imported",
  async run(io, plan, facts) {
    const stackId = facts.stackId;
    if (!stackId) return { ok: false, detail: "Unknown stackId.", fix: "Fix the check above." };
    const listed = await io.run(
      "aws",
      aws(plan, ["iam", "list-open-id-connect-providers", "--output", "json"]),
    );
    const providers = json(listed) as
      | { OpenIDConnectProviderList?: { Arn?: string }[] }
      | undefined;
    if (listed.status !== 0 || !providers) {
      return {
        ok: false,
        detail: "Could not list the account's OIDC providers.",
        fix: "Sign in with a role that may call iam:ListOpenIDConnectProviders.",
      };
    }
    const arn = (providers.OpenIDConnectProviderList ?? [])
      .map((entry) => entry.Arn ?? "")
      .find((entry) => entry.endsWith(`:oidc-provider/${githubIssuer}`));
    if (!arn) return { ok: true, detail: "none yet; the bootstrap stack creates it" };

    const stackName = `${stackId}-bootstrap`;
    const resources = await io.run(
      "aws",
      aws(plan, [
        "cloudformation",
        "describe-stack-resources",
        "--stack-name",
        stackName,
        ...(facts.region ? ["--region", facts.region] : []),
        "--output",
        "json",
      ]),
    );
    if (resources.status !== 0 && !resources.stderr.includes("does not exist")) {
      // Unknown ownership is the one case with no safe guess: importing an owned provider deletes
      // it, creating a second one fails. Better to stop here.
      return {
        ok: false,
        detail: `Could not read ${stackName}, so it is unclear whether it owns ${arn}.`,
        fix: "Sign in with a role that may call cloudformation:DescribeStackResources.",
      };
    }
    const owned = (
      (json(resources) as { StackResources?: { PhysicalResourceId?: string }[] })?.StackResources ??
      []
    ).some((resource) => resource.PhysicalResourceId === arn);
    if (owned) return { ok: true, detail: `${stackName} owns ${arn} and keeps it` };
    facts.providerArn = arn;
    return { ok: true, detail: `imports ${arn}, which the account already has` };
  },
};

/** The ids of the blocks Slidesend creates; short on purpose, see `bucketBudget`. */
export const blockIds = ["sd-data", "sd-rt", "sd-control", "sd-web"];

/**
 * What CloudFormation appends to a bucket's name beyond stack and block: the construct's own
 * suffix, the unique hash and the random tail, with room to spare. A budget, not a measurement —
 * it refuses a name early rather than finding out 63 characters later, halfway into a deploy.
 */
const generatedSuffix = 24;

/**
 * How long the longest bucket name of a deploy would be. S3 refuses anything over 63.
 *
 * Blocks names the stack `<stackId>-prod` in CI and `<stackId>-<user>-<random>` for a personal
 * sandbox, so the sandbox form is the one measured here: it is longer, and it is what a talk
 * author hits first. Two blocks carry buckets, and their ids are short for exactly this reason.
 */
export function longestBucketName(stackId: string, sandboxId = "cabcookie-ab12cd"): string {
  const stack = `${stackId}-${sandboxId}`;
  const longest = [...blockIds].sort((a, b) => b.length - a.length)[0] ?? "";
  return `${stack}-${longest}${"x".repeat(generatedSuffix)}`;
}

const bucketNames: Check = {
  id: "buckets",
  title: "bucket names stay within 63 characters",
  async run(_io, _plan, facts) {
    const stackId = facts.stackId;
    if (!stackId) return { ok: false, detail: "Unknown stackId.", fix: "Fix the check above." };
    const name = longestBucketName(stackId);
    if (name.length > 63) {
      const over = name.length - 63;
      return {
        ok: false,
        detail: `"${name}" is ${name.length} characters, ${over} too many.`,
        fix: `Shorten stackId by ${over} character(s) in .blocks/config.json.`,
      };
    }
    return { ok: true, detail: `${name.length} of 63 at most` };
  },
};

/** Every precondition, in the order in which the setup happens. */
export const bootstrapChecks: readonly Check[] = [
  signedIn,
  hasRegion,
  cdkBootstrapped,
  repositoryIds,
  environmentExists,
  secretsSet,
  esbuildInRoot,
  stackIdSet,
  oidcProvider,
  bucketNames,
];

/** What a full run found. */
export interface BootstrapReport {
  findings: { check: Check; finding: Finding }[];
  facts: Facts;
  ok: boolean;
}

/**
 * Runs the checks in order and keeps going after a failure: one run should list everything that
 * needs doing, not send the person around the loop once per problem.
 */
export async function runChecks(
  io: BootstrapIo,
  plan: BootstrapPlan,
  checks: readonly Check[] = bootstrapChecks,
): Promise<BootstrapReport> {
  const facts: Facts = {};
  const findings: BootstrapReport["findings"] = [];
  for (const check of checks) {
    let finding: Finding;
    try {
      finding = await check.run(io, plan, facts);
    } catch (error) {
      finding = {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        fix: "Fix the error above and run `slidesend bootstrap` again.",
      };
    }
    findings.push({ check, finding });
  }
  return { findings, facts, ok: findings.every(({ finding }) => finding.ok) };
}
