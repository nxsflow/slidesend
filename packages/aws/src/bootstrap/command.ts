/**
 * `slidesend bootstrap` (spec §14): the guided first setup of a talk's AWS account.
 *
 * It runs every precondition first and prints them as a list, because the order matters and
 * because a person who is missing three things should learn all three at once. Only when they
 * all hold does it offer to deploy the bootstrap stack — and even then the deployment is the
 * CDK CLI from the talk project, against the app this package ships, so there is no second
 * source of truth for what gets created.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { PlatformCommandContext } from "@slidesend/core";
import type { BootstrapInput } from "../infra/input";
import { type BootstrapIo, type BootstrapPlan, type BootstrapReport, runChecks } from "./checks";

/** The real terminal: programs are run, files are read, nothing is written. */
export const nodeIo: BootstrapIo = {
  run(command, args) {
    return new Promise((resolve) => {
      const child = spawn(command, [...args], { shell: false });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      // A missing program is an outcome, not a crash: the check then names how to install it.
      child.on("error", (error) => resolve({ status: 127, stdout, stderr: String(error) }));
      child.on("close", (status) => resolve({ status: status ?? 1, stdout, stderr }));
    });
  },
  read(path) {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  },
};

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/**
 * The workspace root: the nearest folder at or above the talk that declares a workspace, else
 * the talk itself. That is where `esbuild` has to be — CDK resolves it upwards from
 * `aws-cdk-lib` in the store, which lands in the root's `node_modules`, never in the talk's.
 */
export function workspaceRootOf(projectRoot: string, io: BootstrapIo = nodeIo): string {
  let folder = projectRoot;
  for (;;) {
    const manifest = io.read(join(folder, "package.json")) ?? "";
    if (io.read(join(folder, "pnpm-workspace.yaml")) !== undefined) return folder;
    if (manifest.includes('"workspaces"')) return folder;
    const parent = dirname(folder);
    if (parent === folder) return projectRoot;
    folder = parent;
  }
}

/**
 * The stack id, read before the checks run. The role's name is built from it, and the checks
 * print that name as part of a remedy, so it has to be known before the first one speaks.
 */
export function stackIdOf(io: BootstrapIo, projectRoot: string): string | undefined {
  const raw = io.read(join(projectRoot, ".blocks", "config.json"));
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as { stackId?: string }).stackId;
  } catch {
    return undefined;
  }
}

/** What the talk's own `aws({ ... })` already settled; the command need not ask again. */
export interface BootstrapDefaults {
  region?: string;
  domain?: string;
  /** Injected in tests; the real one runs programs and reads files. */
  io?: BootstrapIo;
}

/**
 * The plan the command works from: the talk's configuration, overridden by the command line,
 * plus where the talk lives. `--region` beats `aws({ region })` so a first deployment can be
 * tried elsewhere without editing the config.
 */
export function planOf(
  context: PlatformCommandContext,
  defaults: BootstrapDefaults = {},
  stackId = "talk",
): BootstrapPlan {
  const { args, projectRoot } = context;
  const io = defaults.io ?? nodeIo;
  const region = option(args, "--region") ?? defaults.region;
  const domain = option(args, "--domain") ?? defaults.domain;
  return {
    projectRoot,
    workspaceRoot: workspaceRootOf(projectRoot, io),
    ...(option(args, "--profile") ? { profile: option(args, "--profile") } : {}),
    ...(region ? { region } : {}),
    ...(domain ? { domain } : {}),
    environment: option(args, "--environment") ?? "production",
    branch: option(args, "--branch") ?? "main",
    roleName: option(args, "--role") ?? `${stackId}-deploy`,
  };
}

/** The lines the command prints for a finished run; separated out so tests can read them. */
export function reportLines(report: BootstrapReport): string[] {
  const lines = report.findings.map(
    ({ check, finding }) => `  ${finding.ok ? "ok  " : "TODO"}  ${check.title}: ${finding.detail}`,
  );
  const todo = report.findings.filter(({ finding }) => !finding.ok);
  if (todo.length === 0) return [...lines, "", "  Everything is in place."];
  return [
    ...lines,
    "",
    `  ${todo.length} thing(s) to do, in this order:`,
    ...todo.flatMap(({ check, finding }) => [`    ${check.title}`, `      ${finding.fix ?? ""}`]),
  ];
}

/** Where the CDK app of the bootstrap stack lives inside the installed package. */
export function appPath(projectRoot: string): string {
  const require = createRequire(join(projectRoot, "package.json"));
  return join(dirname(require.resolve("@slidesend/aws/package.json")), "dist", "infra", "app.js");
}

/**
 * Runs the checks, prints them, and with `--deploy` deploys the bootstrap stack once they hold.
 * Without `--deploy` it changes nothing at all — that is the point of running it first.
 */
export async function bootstrap(context: PlatformCommandContext, defaults: BootstrapDefaults = {}) {
  const io = defaults.io ?? nodeIo;
  const plan = planOf(context, defaults, stackIdOf(io, context.projectRoot) ?? "talk");
  const report = await runChecks(io, plan);
  context.log("");
  for (const line of reportLines(report)) context.log(line);

  if (!report.ok) {
    context.log("");
    context.log("  Fix those, then run `slidesend bootstrap` again.");
    throw new Error(
      `${report.findings.filter(({ finding }) => !finding.ok).length} check(s) failed.`,
    );
  }
  if (!context.args.includes("--deploy")) {
    context.log("");
    context.log("  Run `slidesend bootstrap --deploy` to create the OIDC provider and the role.");
    return;
  }

  const { facts } = report;
  const input: BootstrapInput = {
    stackName: `${facts.stackId}-bootstrap`,
    account: facts.account ?? "",
    region: facts.region ?? "",
    repository: facts.repository ?? { owner: "", ownerId: 0, name: "", id: 0 },
    environment: plan.environment,
    roleName: plan.roleName,
    immutableSubject: facts.immutableSubject ?? true,
    ...(plan.domain ? { domain: plan.domain } : {}),
    ...(facts.providerArn ? { existingProviderArn: facts.providerArn } : {}),
  };
  context.log("");
  context.log(`  Deploying ${input.stackName} to ${input.account} in ${input.region} …`);
  const status = await new Promise<number>((resolve) => {
    const child = spawn(
      "npx",
      [
        "cdk",
        "deploy",
        "--app",
        `node ${appPath(context.projectRoot)}`,
        "--require-approval",
        "never",
      ],
      {
        cwd: context.projectRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          SLIDESEND_BOOTSTRAP: JSON.stringify(input),
          ...(plan.profile ? { AWS_PROFILE: plan.profile } : {}),
        },
      },
    );
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
  if (status !== 0) throw new Error("The bootstrap deployment failed; see the output above.");
  context.log("");
  context.log("  Next:");
  context.log(
    `    gh secret set AWS_DEPLOY_ROLE --env ${plan.environment} --body <the DeployRoleArn above>`,
  );
  context.log(`    gh secret set AWS_REGION --env ${plan.environment} --body ${input.region}`);
  if (plan.domain) {
    context.log(
      `    Delegate ${plan.domain} to the name servers above, then \`slidesend deploy\`.`,
    );
  }
}
