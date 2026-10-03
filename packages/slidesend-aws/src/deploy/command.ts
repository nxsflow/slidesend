/**
 * `slidesend deploy`, `slidesend open` and `slidesend destroy` (spec §14).
 *
 * The talk's stack is `<stackId>-prod`, as AWS Blocks names a production. It is built by the CDK
 * app this package ships (`dist/infra/talk-app.js`), so the talk project holds no CDK code: it
 * owns `aws-blocks/index.ts` and `aws-blocks/index.handler.ts` because AWS Blocks insists on
 * both, and nothing else.
 *
 * Everything that would otherwise surface as a CloudFormation error twenty minutes in is checked
 * first, and named with its fix. The outside world arrives as one injected object, so the
 * commands are tested against a scripted terminal rather than an AWS account.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { PlatformCommandContext } from "@nxsflow/slidesend-core";
import type { BootstrapIo } from "../bootstrap/checks";
import { nodeIo, stackIdOf } from "../bootstrap/command";
import type { TalkInput } from "../infra/talk-input";

/** What the deploy commands touch besides what the checks read. */
export interface DeployIo extends BootstrapIo {
  /** Runs a program with the terminal attached, so its progress shows; resolves its status. */
  exec(command: string, args: readonly string[], env: Record<string, string>): Promise<number>;
  /** Resolves a module as the talk project would, or `undefined` when it is not installed. */
  resolve(projectRoot: string, specifier: string): string | undefined;
}

export const nodeDeployIo: DeployIo = {
  ...nodeIo,
  exec(command, args, env) {
    return new Promise((resolve) => {
      const child = spawn(command, [...args], {
        stdio: "inherit",
        env: { ...process.env, ...env },
      });
      child.on("error", () => resolve(127));
      child.on("close", (status) => resolve(status ?? 1));
    });
  },
  resolve(projectRoot, specifier) {
    try {
      return createRequire(join(projectRoot, "package.json")).resolve(specifier);
    } catch {
      return undefined;
    }
  },
};

/** What the talk's own `aws({ ... })` already settled. */
export interface DeployDefaults {
  region?: string;
  domain?: string;
  /** Injected in tests; the real one runs programs and reads files. */
  io?: DeployIo;
  /**
   * Whether this runs in CI, where the log may be public: the desk link is then not printed,
   * because it carries the control secret. Defaults to the `CI` variable every CI service sets.
   */
  ci?: boolean;
}

/** What one run works from: the talk's configuration, overridden by the command line. */
export interface DeployPlan {
  projectRoot: string;
  stackName: string;
  region?: string;
  domain?: string;
  profile?: string;
}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/**
 * The plan for one run. `--region` and `--profile` beat the config and the environment, so the
 * same talk can be tried elsewhere without editing a file. Throws when the stack id is missing,
 * because every name below is built from it.
 */
export function deployPlanOf(
  context: PlatformCommandContext,
  defaults: DeployDefaults,
  io: DeployIo,
): DeployPlan {
  const { args, projectRoot } = context;
  const stackId = stackIdOf(io, projectRoot);
  if (!stackId) {
    throw new Error(
      '.blocks/config.json names no stackId; add { "stackId": "<short-name>" } to it, e.g. "sd-mytalk".',
    );
  }
  const region = option(args, "--region") ?? defaults.region;
  const profile = option(args, "--profile");
  return {
    projectRoot,
    stackName: `${stackId}-prod`,
    ...(region ? { region } : {}),
    ...(defaults.domain ? { domain: defaults.domain } : {}),
    ...(profile ? { profile } : {}),
  };
}

/** `--profile` and `--region` for every `aws` call, so they all ask the same account. */
function awsArgs(plan: DeployPlan): string[] {
  return [
    ...(plan.profile ? ["--profile", plan.profile] : []),
    ...(plan.region ? ["--region", plan.region] : []),
  ];
}

const json = <T>(text: string): T | undefined => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

/** The account the credentials belong to; throws with the way to sign in when there are none. */
async function accountOf(io: DeployIo, plan: DeployPlan): Promise<string> {
  const result = await io.run("aws", ["sts", "get-caller-identity", ...awsArgs(plan)]);
  const account = json<{ Account?: string }>(result.stdout)?.Account;
  if (result.status !== 0 || !account) {
    throw new Error(
      plan.profile
        ? `The AWS profile "${plan.profile}" is not signed in: aws sso login --profile ${plan.profile}`
        : "No AWS credentials: sign in, e.g. aws sso login --profile <profile>, and pass --profile <profile>.",
    );
  }
  return account;
}

/** The programs and files a deploy needs, each named with its fix when it is missing. */
export function deployTools(
  io: DeployIo,
  projectRoot: string,
): { cdk: string; tsx: string; app: string } {
  const missing: string[] = [];
  for (const file of ["index.ts", "index.handler.ts"]) {
    if (io.read(join(projectRoot, "aws-blocks", file)) === undefined) {
      missing.push(
        file === "index.ts"
          ? "aws-blocks/index.ts, the talk's backend (see createAwsBackend)"
          : 'aws-blocks/index.handler.ts with: import { createLambdaHandler } from "@aws-blocks/blocks/lambda-handler"; export const handler = createLambdaHandler(() => import("./index.js"));',
      );
    }
  }
  const cdk = io.resolve(projectRoot, "aws-cdk/bin/cdk");
  if (!cdk) missing.push("the CDK CLI: pnpm add -D aws-cdk");
  const tsx = io.resolve(projectRoot, "tsx/cli");
  if (!tsx) missing.push("tsx: pnpm add -D tsx");
  // Through the manifest, as `slidesend bootstrap` finds its app: the app is no export of its
  // own, so no bundler and no import condition ever has to know about it.
  const manifest = io.resolve(projectRoot, "@nxsflow/slidesend-aws/package.json");
  const app = manifest ? join(dirname(manifest), "dist", "infra", "talk-app.js") : undefined;
  if (!app) missing.push("@nxsflow/slidesend-aws, built: pnpm add @nxsflow/slidesend-aws");
  if (missing.length > 0 || !cdk || !tsx || !app) {
    throw new Error(
      `The talk cannot be deployed yet. Missing:\n${missing.map((m) => `    - ${m}`).join("\n")}`,
    );
  }
  return { cdk, tsx, app };
}

/** The CDK CLI's arguments for one action; the app runs under the `cdk` export condition. */
export function cdkArgs(
  action: "deploy" | "destroy",
  tools: { cdk: string; tsx: string; app: string },
  outputsFile = "",
): string[] {
  const app = `node "${tools.tsx}" -C cdk "${tools.app}"`;
  return action === "deploy"
    ? [
        tools.cdk,
        "deploy",
        "--app",
        app,
        "--require-approval",
        "never",
        "--ci",
        "--progress",
        "events",
        "--outputs-file",
        outputsFile,
      ]
    : [tools.cdk, "destroy", "--app", app, "--force"];
}

/** Everything the CDK app learns about this run, in one variable. */
function cdkEnv(plan: DeployPlan, account: string): Record<string, string> {
  const region = plan.region ?? process.env.AWS_REGION ?? "";
  const input: TalkInput = {
    stackName: plan.stackName,
    projectRoot: plan.projectRoot,
    account,
    region,
    // The site is built while the stack is synthesized, and it has to talk to AWS Blocks.
    buildCommand: "npm run build",
    ...(plan.domain ? { domain: plan.domain } : {}),
  };
  return {
    SLIDESEND_DEPLOY: JSON.stringify(input),
    VITE_SLIDESEND_PLATFORM: "aws",
    ...(region ? { AWS_REGION: region, CDK_DEFAULT_REGION: region } : {}),
    ...(plan.profile ? { AWS_PROFILE: plan.profile } : {}),
  };
}

/** The site's address from the stack's outputs: the custom domain if there is one. */
export function siteUrl(
  outputs: readonly { OutputKey?: string; OutputValue?: string }[],
  domain?: string,
): string | undefined {
  if (domain) return `https://${domain}`;
  const hosting = outputs.find(({ OutputKey }) => OutputKey?.includes("HostingUrl"));
  return hosting?.OutputValue?.replace(/\/$/, "");
}

/**
 * The control secret as the backend reads it. AWS Blocks generates it on the first deploy as a
 * raw string, while a value written through the block is JSON — the same fallback as its `get`.
 */
export function secretValue(raw: string): string {
  const parsed = json<unknown>(raw);
  return typeof parsed === "string" ? parsed : raw;
}

/** The desk link: the secret travels in the fragment, which no server and no log ever sees. */
export function deskLink(url: string, secret: string): string {
  return `${url}/desk#key=${secret}`;
}

/**
 * Where `slidesend deploy` has the CDK CLI write the stack's outputs: the folder AWS Blocks
 * keeps its own deploy state in, which a talk project ignores already. Reading the address from
 * here needs no permission beyond the deploy itself — the CI role has none.
 */
export const outputsFileOf = (projectRoot: string) =>
  join(projectRoot, ".blocks-sandbox", "outputs.json");

/** The site's address from the outputs file a deploy just wrote. */
export function deployedUrl(io: DeployIo, plan: DeployPlan): string | undefined {
  const all = json<Record<string, Record<string, string>>>(
    io.read(outputsFileOf(plan.projectRoot)) ?? "",
  );
  const outputs = Object.entries(all?.[plan.stackName] ?? {}).map(([OutputKey, OutputValue]) => ({
    OutputKey,
    OutputValue,
  }));
  return siteUrl(outputs, plan.domain);
}

/** Reads the deployed talk's address and control secret; throws when the stack is not there. */
async function linksOf(io: DeployIo, plan: DeployPlan): Promise<{ url: string; secret: string }> {
  const stack = await io.run("aws", [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    plan.stackName,
    "--output",
    "json",
    ...awsArgs(plan),
  ]);
  const outputs =
    json<{ Stacks?: { Outputs?: { OutputKey?: string; OutputValue?: string }[] }[] }>(stack.stdout)
      ?.Stacks?.[0]?.Outputs ?? [];
  const url = stack.status === 0 ? siteUrl(outputs, plan.domain) : undefined;
  if (!url) {
    throw new Error(
      `No deployed talk "${plan.stackName}"${plan.region ? ` in ${plan.region}` : ""}: run \`slidesend deploy\` first.`,
    );
  }
  return { url, secret: await secretOf(io, plan) };
}

/** The control secret from SSM, where AWS Blocks generated it on the first deploy. */
async function secretOf(io: DeployIo, plan: DeployPlan): Promise<string> {
  // The parameter is named after the block's place in the scope tree; its stack prefix and the
  // block id at the end are what is fixed.
  const listed = await io.run("aws", [
    "ssm",
    "describe-parameters",
    "--parameter-filters",
    `Key=Name,Option=BeginsWith,Values=/${plan.stackName}-`,
    "--output",
    "json",
    ...awsArgs(plan),
  ]);
  const name = json<{ Parameters?: { Name?: string }[] }>(listed.stdout)
    ?.Parameters?.map((parameter) => parameter.Name ?? "")
    .find((candidate) => candidate.endsWith("-sd-control"));
  if (!name) throw new Error(`The stack "${plan.stackName}" has no control secret in SSM.`);
  const read = await io.run("aws", [
    "ssm",
    "get-parameter",
    "--name",
    name,
    "--with-decryption",
    "--output",
    "json",
    ...awsArgs(plan),
  ]);
  const raw = json<{ Parameter?: { Value?: string } }>(read.stdout)?.Parameter?.Value;
  if (read.status !== 0 || !raw) throw new Error(`The control secret ${name} could not be read.`);
  return secretValue(raw);
}

function printLinks(context: PlatformCommandContext, links: { url: string; secret: string }) {
  context.log(`  Desk   ${deskLink(links.url, links.secret)}`);
  context.log(`  Phones ${links.url}/`);
  context.log(
    "  The desk link carries the control secret: share it only with whoever runs the talk.",
  );
}

/** `slidesend deploy`: builds the site, deploys the stack and prints the desk link. */
export async function deploy(context: PlatformCommandContext, defaults: DeployDefaults = {}) {
  const io = defaults.io ?? nodeDeployIo;
  const plan = deployPlanOf(context, defaults, io);
  const tools = deployTools(io, plan.projectRoot);
  const account = await accountOf(io, plan);
  context.log(
    `  Deploying ${plan.stackName} to ${account}${plan.region ? ` in ${plan.region}` : ""} …`,
  );
  const [command, ...args] = ["node", ...cdkArgs("deploy", tools, outputsFileOf(plan.projectRoot))];
  const status = await io.exec(command as string, args, cdkEnv(plan, account));
  if (status !== 0) throw new Error("The deployment failed; see the output above.");
  const url = deployedUrl(io, plan);
  if (!url) throw new Error("The stack was deployed, but its outputs name no site address.");
  context.log("");
  if (defaults.ci ?? process.env.CI === "true") {
    context.log(`  Site   ${url}/`);
    context.log(
      "  The desk link carries the control secret, so it is not printed here: run `slidesend open` where you are signed in.",
    );
    return;
  }
  printLinks(context, { url, secret: await secretOf(io, plan) });
}

/** `slidesend open`: prints the desk link of the deployed talk again. */
export async function open(context: PlatformCommandContext, defaults: DeployDefaults = {}) {
  const io = defaults.io ?? nodeDeployIo;
  const plan = deployPlanOf(context, defaults, io);
  printLinks(context, await linksOf(io, plan));
}

/**
 * `slidesend destroy`: removes the talk's stack — site, API, tables and the audience's answers
 * with it — and says what it leaves behind on purpose.
 */
export async function destroy(context: PlatformCommandContext, defaults: DeployDefaults = {}) {
  const io = defaults.io ?? nodeDeployIo;
  const plan = deployPlanOf(context, defaults, io);
  const tools = deployTools(io, plan.projectRoot);
  const account = await accountOf(io, plan);
  context.log(
    `  Destroying ${plan.stackName} in ${account}${plan.region ? ` in ${plan.region}` : ""} …`,
  );
  const [command, ...args] = ["node", ...cdkArgs("destroy", tools)];
  const status = await io.exec(command as string, args, cdkEnv(plan, account));
  if (status !== 0) throw new Error("The destroy failed; see the output above.");
  const stackId = plan.stackName.replace(/-prod$/, "");
  context.log("");
  context.log("  Left in place, because a next deploy needs them:");
  context.log(`    - the bootstrap stack ${stackId}-bootstrap (OIDC provider and deploy role)`);
  context.log("    - the CDK bootstrap (CDKToolkit) of the account and region");
  if (plan.domain)
    context.log(`    - the hosted zone of ${plan.domain}, delegated at your registrar`);
  context.log(
    `    - Lambda log groups /aws/lambda/${plan.stackName}-*, until their retention ends`,
  );
}
