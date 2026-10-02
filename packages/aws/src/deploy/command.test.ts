/**
 * `slidesend deploy`, `open` and `destroy` against a scripted terminal: what they refuse before
 * anything is touched, what they hand the CDK CLI, and the link they print afterwards.
 */
import { describe, expect, it } from "vitest";
import { talkInput } from "../infra/talk-input";
import {
  cdkArgs,
  type DeployIo,
  deploy,
  deployPlanOf,
  deployTools,
  deskLink,
  destroy,
  open,
  secretValue,
  siteUrl,
} from "./command";

const root = "/work/talks/gravity";

const files: Record<string, string> = {
  [`${root}/.blocks/config.json`]: '{"stackId":"sd-gravity"}',
  [`${root}/aws-blocks/index.ts`]: "export const slidesend = {};",
  [`${root}/aws-blocks/index.handler.ts`]: "export const handler = {};",
  // What the CDK CLI writes after a deploy, keyed by stack.
  [`${root}/.blocks-sandbox/outputs.json`]:
    '{"sd-gravity-prod":{"ApiUrl":"https://x.execute-api","WebHostingUrlAB12":"https://d1.cloudfront.net/"}}',
};

const modules: Record<string, string> = {
  "aws-cdk/bin/cdk": "/store/aws-cdk/bin/cdk",
  "tsx/cli": "/store/tsx/dist/cli.mjs",
  "@slidesend/aws/package.json": "/store/slidesend-aws/package.json",
};

const answers: Record<string, string> = {
  "sts get-caller-identity": '{"Account":"314201982767"}',
  "describe-stacks":
    '{"Stacks":[{"Outputs":[{"OutputKey":"ApiUrl","OutputValue":"https://x.execute-api"},{"OutputKey":"WebHostingUrlAB12","OutputValue":"https://d1.cloudfront.net/"}]}]}',
  "describe-parameters":
    '{"Parameters":[{"Name":"/sd-gravity-prod-gravity-sd-data"},{"Name":"/sd-gravity-prod-gravity-sd-control"}]}',
  "get-parameter": '{"Parameter":{"Value":"s3cr3t"}}',
};

function io(
  overrides: {
    files?: Record<string, string | undefined>;
    modules?: Record<string, string | undefined>;
    answers?: Record<string, string | undefined>;
    status?: number;
  } = {},
) {
  const content = { ...files, ...overrides.files };
  const resolvable = { ...modules, ...overrides.modules };
  const all = { ...answers, ...overrides.answers };
  const ran: string[] = [];
  const executed: { command: string; args: readonly string[]; env: Record<string, string> }[] = [];
  const terminal: DeployIo = {
    async run(command, args) {
      const line = [command, ...args].join(" ");
      ran.push(line);
      const match = Object.entries(all).find(([pattern]) => line.includes(pattern))?.[1];
      return match
        ? { status: 0, stdout: match, stderr: "" }
        : { status: 255, stdout: "", stderr: "not found" };
    },
    read: (path) => content[path],
    resolve: (_root, specifier) => resolvable[specifier],
    async exec(command, args, env) {
      executed.push({ command, args, env });
      return overrides.status ?? 0;
    },
  };
  return { io: terminal, ran, executed };
}

function context(args: string[] = []) {
  const lines: string[] = [];
  return { context: { projectRoot: root, args, log: (line: string) => lines.push(line) }, lines };
}

describe("the deploy plan", () => {
  it("names the stack as AWS Blocks names a production, and lets the command line win", () => {
    const plan = deployPlanOf(
      context(["--region", "eu-west-1", "--profile", "talk"]).context,
      { region: "eu-central-1", domain: "talk.example.com" },
      io().io,
    );
    expect(plan).toEqual({
      projectRoot: root,
      stackName: "sd-gravity-prod",
      region: "eu-west-1",
      domain: "talk.example.com",
      profile: "talk",
    });
  });

  it("refuses a talk without a stack id, because every name is built from it", () => {
    expect(() =>
      deployPlanOf(
        context().context,
        {},
        io({ files: { [`${root}/.blocks/config.json`]: undefined } }).io,
      ),
    ).toThrow(/names no stackId/);
  });
});

describe("the tools a deploy needs", () => {
  it("names every missing piece with its fix, all at once", () => {
    const { io: terminal } = io({
      files: { [`${root}/aws-blocks/index.handler.ts`]: undefined },
      modules: { "aws-cdk/bin/cdk": undefined, "tsx/cli": undefined },
    });
    let message = "";
    try {
      deployTools(terminal, root);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("aws-blocks/index.handler.ts with: import { createLambdaHandler }");
    expect(message).toContain("pnpm add -D aws-cdk");
    expect(message).toContain("pnpm add -D tsx");
    expect(message).not.toContain("aws-blocks/index.ts,");
  });

  it("runs the shipped CDK app under the cdk condition, without approval prompts", () => {
    const tools = deployTools(io().io, root);
    expect(cdkArgs("deploy", tools, "/out.json")).toEqual([
      "/store/aws-cdk/bin/cdk",
      "deploy",
      "--app",
      'node "/store/tsx/dist/cli.mjs" -C cdk "/store/slidesend-aws/dist/infra/talk-app.js"',
      "--require-approval",
      "never",
      "--ci",
      "--progress",
      "events",
      "--outputs-file",
      "/out.json",
    ]);
    expect(cdkArgs("destroy", tools).slice(1, 2)).toEqual(["destroy"]);
    expect(cdkArgs("destroy", tools).at(-1)).toBe("--force");
  });
});

describe("the links", () => {
  it("prefers the custom domain, else the hosting URL without its trailing slash", () => {
    const outputs = [
      { OutputKey: "ApiUrl", OutputValue: "https://x.execute-api" },
      { OutputKey: "WebHostingUrlAB12", OutputValue: "https://d1.cloudfront.net/" },
    ];
    expect(siteUrl(outputs)).toBe("https://d1.cloudfront.net");
    expect(siteUrl(outputs, "talk.example.com")).toBe("https://talk.example.com");
    expect(siteUrl([{ OutputKey: "ApiUrl", OutputValue: "https://x" }])).toBeUndefined();
  });

  it("reads the secret raw as AWS Blocks generates it, and as JSON as the block writes it", () => {
    expect(secretValue("abc-DEF_123")).toBe("abc-DEF_123");
    expect(secretValue('"abc"')).toBe("abc");
  });

  it("keeps the secret in the fragment, which no server sees", () => {
    expect(deskLink("https://d1.cloudfront.net", "k")).toBe("https://d1.cloudfront.net/desk#key=k");
  });
});

describe("slidesend deploy", () => {
  it("deploys into the signed-in account and prints the desk link afterwards", async () => {
    const { io: terminal, executed, ran } = io();
    const { context: ctx, lines } = context(["--profile", "talk"]);
    await deploy(ctx, { region: "eu-central-1", io: terminal, ci: false });

    expect(executed).toHaveLength(1);
    const [run] = executed;
    expect(run?.command).toBe("node");
    expect(run?.args[1]).toBe("deploy");
    expect(run?.args.at(-1)).toBe(`${root}/.blocks-sandbox/outputs.json`);
    const input = talkInput(run?.env.SLIDESEND_DEPLOY);
    expect(input).toEqual({
      stackName: "sd-gravity-prod",
      projectRoot: root,
      account: "314201982767",
      region: "eu-central-1",
      buildCommand: "npm run build",
    });
    expect(run?.env).toMatchObject({
      VITE_SLIDESEND_PLATFORM: "aws",
      AWS_REGION: "eu-central-1",
      AWS_PROFILE: "talk",
    });
    // Every AWS call asks the same account.
    for (const line of ran) expect(line).toContain("--profile talk --region eu-central-1");
    expect(lines).toContain("  Desk   https://d1.cloudfront.net/desk#key=s3cr3t");
    expect(lines).toContain("  Phones https://d1.cloudfront.net/");
  });

  it("prints no desk link in CI, where the log may be public, and needs no read permission", async () => {
    const { io: terminal, ran } = io();
    const { context: ctx, lines } = context();
    await deploy(ctx, { region: "eu-central-1", io: terminal, ci: true });
    const text = lines.join("\n");
    expect(text).toContain("  Site   https://d1.cloudfront.net/");
    expect(text).toContain("run `slidesend open` where you are signed in");
    expect(text).not.toContain("s3cr3t");
    // The deploy role may assume the CDK roles and nothing else: no stack or SSM reads.
    expect(ran.filter((line) => !line.includes("sts get-caller-identity"))).toEqual([]);
  });

  it("names the sign-in before anything is deployed", async () => {
    const { io: terminal, executed } = io({ answers: { "sts get-caller-identity": undefined } });
    await expect(
      deploy(context(["--profile", "talk"]).context, { region: "eu-central-1", io: terminal }),
    ).rejects.toThrow("aws sso login --profile talk");
    expect(executed).toHaveLength(0);
  });

  it("fails when the CDK CLI fails, without printing a link to nothing", async () => {
    const { io: terminal } = io({ status: 1 });
    const { context: ctx, lines } = context();
    await expect(deploy(ctx, { io: terminal, ci: false })).rejects.toThrow("The deployment failed");
    expect(lines.some((line) => line.includes("Desk"))).toBe(false);
  });
});

describe("slidesend open", () => {
  it("prints the link of the deployed talk without deploying anything", async () => {
    const { io: terminal, executed } = io();
    const { context: ctx, lines } = context();
    await open(ctx, { region: "eu-central-1", io: terminal });
    expect(executed).toHaveLength(0);
    expect(lines[0]).toBe("  Desk   https://d1.cloudfront.net/desk#key=s3cr3t");
  });

  it("says so when the talk is not deployed", async () => {
    const { io: terminal } = io({ answers: { "describe-stacks": undefined } });
    await expect(open(context().context, { region: "eu-central-1", io: terminal })).rejects.toThrow(
      'No deployed talk "sd-gravity-prod" in eu-central-1',
    );
  });

  it("finds the control secret by the stack's prefix and the block id", async () => {
    const { io: terminal, ran } = io({
      answers: { "describe-parameters": '{"Parameters":[{"Name":"/sd-gravity-prod-x-sd-data"}]}' },
    });
    await expect(open(context().context, { io: terminal })).rejects.toThrow("no control secret");
    expect(ran.find((line) => line.includes("describe-parameters"))).toContain(
      "Key=Name,Option=BeginsWith,Values=/sd-gravity-prod-",
    );
  });
});

describe("slidesend destroy", () => {
  it("destroys the talk's stack and says what it leaves in place", async () => {
    const { io: terminal, executed } = io();
    const { context: ctx, lines } = context();
    await destroy(ctx, { region: "eu-central-1", domain: "talk.example.com", io: terminal });
    expect(executed[0]?.args[1]).toBe("destroy");
    const text = lines.join("\n");
    expect(text).toContain("sd-gravity-bootstrap");
    expect(text).toContain("CDKToolkit");
    expect(text).toContain("hosted zone of talk.example.com");
  });
});
