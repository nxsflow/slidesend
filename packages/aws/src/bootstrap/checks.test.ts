/**
 * Every check is tested twice: once where it holds, once where it does not — and the failing
 * case asserts the printed remedy, because a check that only says "no" sends the person to a
 * search engine instead of to the fix.
 */
import { describe, expect, it } from "vitest";
import {
  type BootstrapIo,
  type BootstrapPlan,
  bootstrapChecks,
  branchPolicyRemedy,
  environmentRemedy,
  type Facts,
  longestBucketName,
  runChecks,
} from "./checks";

const plan: BootstrapPlan = {
  projectRoot: "/talk",
  workspaceRoot: "/talk",
  profile: "talks",
  region: "eu-central-1",
  environment: "production",
  branch: "main",
  roleName: "gravity-deploy",
};

/** A scripted terminal: commands are matched by a substring of the whole command line. */
function terminal(
  script: Record<string, Partial<Run> | undefined>,
  files: Record<string, string> = {},
): BootstrapIo {
  return {
    async run(command, args) {
      const line = [command, ...args].join(" ");
      // A pattern ending in "$" must match the end of the command line. Without that,
      // `repos/<slug>` would also answer `repos/<slug>/environments/<name>`.
      const matches = Object.entries(script).filter(([pattern]) =>
        pattern.endsWith("$") ? line.endsWith(pattern.slice(0, -1)) : line.includes(pattern),
      );
      const match = matches.sort(([a], [b]) => b.length - a.length)[0];
      return { status: 0, stdout: "", stderr: "", ...(match?.[1] ?? { status: 127 }) };
    },
    read: (path) => files[path],
  };
}
type Run = { status: number; stdout: string; stderr: string };

const identity = { stdout: '{"Account":"123456789012","Arn":"arn:aws:sts::123456789012:x"}' };
const parameter = { stdout: '{"Parameter":{"Value":"26"}}' };
const repoView = { stdout: "cabcookie/gravity\n" };
const repoApi = {
  stdout: '{"id":1369593468,"name":"gravity","owner":{"login":"cabcookie","id":2454422}}',
};
const subApi = { stdout: '{"use_default":true,"use_immutable_subject":true}' };
const environmentApi = {
  stdout:
    '{"name":"production","deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}',
};
const branchPoliciesApi = { stdout: '{"branch_policies":[{"name":"main","type":"branch"}]}' };
const secretsApi = { stdout: '[{"name":"AWS_DEPLOY_ROLE"},{"name":"AWS_REGION"}]' };

/** Everything in place: the happy world each test then takes one thing away from. */
const working = {
  script: {
    "sts get-caller-identity": identity,
    "configure get region": { stdout: "eu-central-1\n" },
    "ssm get-parameter": parameter,
    "repo view": repoView,
    "gh api repos/cabcookie/gravity$": repoApi,
    "actions/oidc/customization/sub": subApi,
    "environments/production$": environmentApi,
    "environments/production/deployment-branch-policies": branchPoliciesApi,
    "secret list": secretsApi,
  } as Record<string, Partial<Run> | undefined>,
  files: {
    "/talk/package.json": '{"devDependencies":{"esbuild":"^0.28.2"}}',
    "/talk/.blocks/config.json": '{"stackId":"sd-gravity"}',
  } as Record<string, string>,
};

function check(id: string) {
  const found = bootstrapChecks.find((entry) => entry.id === id);
  if (!found) throw new Error(`No check "${id}"`);
  return found;
}

/** Runs one check against the working world, minus what `without` removes. */
async function run(
  id: string,
  without: { script?: string[]; files?: string[] } = {},
  facts: Facts = {},
  overrides: Partial<BootstrapPlan> = {},
) {
  const script = { ...working.script };
  for (const key of without.script ?? []) script[key] = undefined;
  const files = { ...working.files };
  for (const key of without.files ?? []) delete files[key];
  return check(id).run(terminal(script, files), { ...plan, ...overrides }, facts);
}

describe("the bootstrap checks", () => {
  it("reads the account from the signed-in profile", async () => {
    const facts: Facts = {};
    expect(await run("profile", {}, facts)).toMatchObject({ ok: true });
    expect(facts.account).toBe("123456789012");
  });

  it("sends an expired session to the right login", async () => {
    expect(await run("profile", { script: ["sts get-caller-identity"] })).toMatchObject({
      ok: false,
      fix: expect.stringContaining("aws sso login --profile talks"),
    });
  });

  it("takes the region from the profile when none was named", async () => {
    const facts: Facts = {};
    expect(await run("region", {}, facts, { region: undefined })).toMatchObject({
      ok: true,
      detail: "eu-central-1",
    });
    expect(facts.region).toBe("eu-central-1");
  });

  it("refuses something that is not a region", async () => {
    expect(await run("region", {}, {}, { region: "europe" })).toMatchObject({
      ok: false,
      fix: "slidesend bootstrap --region eu-central-1",
    });
  });

  it("also wants us-east-1 bootstrapped when the talk has a custom domain", async () => {
    const asked: string[] = [];
    const io: BootstrapIo = {
      async run(command, args) {
        asked.push([command, ...args].join(" "));
        return { status: 0, stdout: '{"Parameter":{"Value":"26"}}', stderr: "" };
      },
      read: () => undefined,
    };
    const finding = await check("cdk").run(
      io,
      { ...plan, domain: "talk.example.com" },
      { account: "123456789012", region: "eu-central-1" },
    );
    expect(finding.ok).toBe(true);
    // The certificate CloudFront serves can only live in us-east-1.
    expect(asked.some((line) => line.includes("--region us-east-1"))).toBe(true);
  });

  it("accepts a bootstrapped account", async () => {
    expect(await run("cdk", {}, { account: "123456789012", region: "eu-central-1" })).toMatchObject(
      { ok: true, detail: "eu-central-1 version 26" },
    );
  });

  it("names the bootstrap command for the account and region at hand", async () => {
    expect(
      await run(
        "cdk",
        { script: ["ssm get-parameter"] },
        { account: "123456789012", region: "eu-central-1" },
      ),
    ).toMatchObject({
      ok: false,
      fix: "npx cdk bootstrap aws://123456789012/eu-central-1",
    });
  });

  it("rejects a bootstrap that is too old to deploy with", async () => {
    const io = terminal({
      ...working.script,
      "ssm get-parameter": { stdout: '{"Parameter":{"Value":"6"}}' },
    });
    expect(
      await check("cdk").run(io, plan, { account: "1", region: "eu-central-1" }),
    ).toMatchObject({
      ok: false,
      detail: expect.stringContaining("version 6 in eu-central-1 is too old"),
    });
  });

  it("reads the numeric ids and the subject form from GitHub", async () => {
    const facts: Facts = {};
    expect(await run("repository", {}, facts)).toMatchObject({ ok: true });
    expect(facts.repository).toEqual({
      owner: "cabcookie",
      ownerId: 2454422,
      name: "gravity",
      id: 1369593468,
    });
    expect(facts.immutableSubject).toBe(true);
  });

  it("notices a repository that switched immutable subjects off", async () => {
    const io = terminal({
      ...working.script,
      "actions/oidc/customization/sub": { stdout: '{"use_immutable_subject":false}' },
    });
    const facts: Facts = {};
    await check("repository").run(io, plan, facts);
    expect(facts.immutableSubject).toBe(false);
  });

  it("asks for a GitHub login when gh cannot answer", async () => {
    expect(await run("repository", { script: ["repo view"] })).toMatchObject({
      ok: false,
      fix: expect.stringContaining("gh auth login"),
    });
  });

  const repository = { owner: "cabcookie", ownerId: 2454422, name: "gravity", id: 1369593468 };

  it("accepts an environment whose branch policy names the deployment branch", async () => {
    expect(await run("environment", {}, { repository })).toMatchObject({
      ok: true,
      detail: '"production" admits main',
    });
  });

  // One step, and the next run passes: the environment with a policy naming the branch. A bare
  // PUT created it without one, and the next run failed again with a second remedy.
  const remedy =
    'gh api --method PUT repos/cabcookie/gravity/environments/production -F "deployment_branch_policy[protected_branches]=false" -F "deployment_branch_policy[custom_branch_policies]=true" && gh api --method POST repos/cabcookie/gravity/environments/production/deployment-branch-policies -f name=main';

  it("creates a missing environment and its branch policy in one step", async () => {
    expect(environmentRemedy("cabcookie/gravity", "production", "main")).toBe(remedy);
    expect(
      await run("environment", { script: ["environments/production$"] }, { repository }),
    ).toMatchObject({ ok: false, fix: remedy });
  });

  it("insists on a branch rule, because the trust policy carries no branch", async () => {
    const io = terminal({
      ...working.script,
      "environments/production$": {
        stdout: '{"name":"production","deployment_branch_policy":null}',
      },
    });
    expect(await check("environment").run(io, plan, { repository })).toMatchObject({
      ok: false,
      detail: '"production" accepts a deployment from any branch.',
      fix: remedy,
    });
  });

  const protectedOnly = {
    stdout:
      '{"name":"production","deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}',
  };

  it("sees that 'protected branches only' admits nothing while the branch is unprotected", async () => {
    const io = terminal({
      ...working.script,
      "environments/production$": protectedOnly,
      "branches/main": { stdout: '{"name":"main","protected":false}' },
    });
    expect(await check("environment").run(io, plan, { repository })).toMatchObject({
      ok: false,
      detail: expect.stringContaining("main is not protected"),
      fix: remedy,
    });
  });

  it("accepts 'protected branches only' when the branch is protected", async () => {
    const io = terminal({
      ...working.script,
      "environments/production$": protectedOnly,
      "branches/main": { stdout: '{"name":"main","protected":true}' },
    });
    expect(await check("environment").run(io, plan, { repository })).toMatchObject({ ok: true });
  });

  it("adds the branch to custom policies that name other branches", async () => {
    const io = terminal({
      ...working.script,
      "environments/production/deployment-branch-policies": {
        stdout: '{"branch_policies":[{"name":"release","type":"branch"}]}',
      },
    });
    expect(await check("environment").run(io, plan, { repository })).toMatchObject({
      ok: false,
      detail: '"production" does not admit main (only release).',
      fix: branchPolicyRemedy("cabcookie/gravity", "production", "main"),
    });
  });

  it("says that a private repository on GitHub Free has no environments", async () => {
    const io = terminal({
      ...working.script,
      "environments/production$": { status: 1, stdout: '{"message":"Not Found"}' },
      "gh api user$": { stdout: '{"login":"cabcookie","plan":{"name":"free"}}' },
    });
    const finding = await check("environment").run(io, plan, {
      repository,
      private: true,
      ownerType: "User",
    });
    expect(finding).toMatchObject({
      ok: false,
      detail:
        "cabcookie/gravity is private, and private repositories on GitHub Free have no environments.",
    });
    expect(finding.fix).toContain("gh repo edit cabcookie/gravity --visibility public");
    expect(finding.fix).not.toContain("--method PUT");
  });

  it("does not guess a plan it cannot see", async () => {
    // Signed in as somebody else: their plan says nothing about the owner's.
    const io = terminal({
      ...working.script,
      "environments/production$": { status: 1, stdout: '{"message":"Not Found"}' },
      "gh api user$": { stdout: '{"login":"someone-else","plan":{"name":"free"}}' },
    });
    expect(
      await check("environment").run(io, plan, { repository, private: true, ownerType: "User" }),
    ).toMatchObject({ ok: false, fix: remedy });
  });

  it("reads an organization's plan from the organization", async () => {
    const io = terminal({
      ...working.script,
      "environments/production$": { status: 1, stdout: '{"message":"Not Found"}' },
      "gh api orgs/cabcookie$": { stdout: '{"login":"cabcookie","plan":{"name":"free"}}' },
    });
    const finding = await check("environment").run(io, plan, {
      repository,
      private: true,
      ownerType: "Organization",
    });
    expect(finding.detail).toContain("GitHub Free");
  });

  it("accepts both deploy secrets", async () => {
    expect(await run("secrets", {}, { repository })).toMatchObject({ ok: true });
  });

  it("names the missing secret and the role ARN to put into it", async () => {
    const io = terminal({
      ...working.script,
      "secret list": { stdout: '[{"name":"AWS_REGION"}]' },
    });
    expect(
      await check("secrets").run(io, plan, {
        repository,
        account: "123456789012",
        region: "eu-central-1",
      }),
    ).toMatchObject({
      ok: false,
      detail: expect.stringContaining("AWS_DEPLOY_ROLE"),
      fix: expect.stringContaining(
        "gh secret set AWS_DEPLOY_ROLE --env production --body arn:aws:iam::123456789012:role/gravity-deploy",
      ),
    });
  });

  it("finds esbuild in the workspace root", async () => {
    expect(await run("esbuild")).toMatchObject({ ok: true });
  });

  it("sends esbuild to the root, not to the talk package", async () => {
    expect(await run("esbuild", { files: ["/talk/package.json"] })).toMatchObject({
      ok: false,
      fix: expect.stringContaining("pnpm add -Dw esbuild"),
    });
  });

  it("reads the stack id", async () => {
    const facts: Facts = {};
    expect(await run("stackId", {}, facts)).toMatchObject({ ok: true, detail: "sd-gravity" });
    expect(facts.stackId).toBe("sd-gravity");
  });

  it("asks for a stack id when the config has none", async () => {
    expect(await run("stackId", { files: ["/talk/.blocks/config.json"] })).toMatchObject({
      ok: false,
      fix: expect.stringContaining('"stackId"'),
    });
  });

  it("rejects a stack id that S3 could not carry", async () => {
    const io = terminal(working.script, {
      ...working.files,
      "/talk/.blocks/config.json": '{"stackId":"SD_Gravity"}',
    });
    expect(await check("stackId").run(io, plan, {})).toMatchObject({
      ok: false,
      detail: expect.stringContaining("lowercase"),
    });
  });

  it("measures the longest bucket name a deploy would ask for", async () => {
    expect(await run("buckets", {}, { stackId: "sd-gravity" })).toMatchObject({ ok: true });
    // The sandbox stack name is the long one: `<stackId>-<user>-<random>`, plus the longest
    // block id and what CloudFormation appends.
    expect(longestBucketName("sd-gravity")).toContain("sd-gravity-cabcookie-ab12cd-sd-control");
    expect(longestBucketName("sd-gravity").length).toBeLessThanOrEqual(63);
  });

  it("says by how much a long stack id overshoots 63 characters", async () => {
    const stackId = `sd-${"a".repeat(50)}`;
    const finding = await run("buckets", {}, { stackId });
    expect(finding).toMatchObject({
      ok: false,
      fix: expect.stringContaining("Shorten stackId by"),
    });
    expect(finding.detail).toContain(`${longestBucketName(stackId).length} characters`);
  });
});

describe("a full run", () => {
  it("passes when everything is in place and carries the facts for the stack", async () => {
    const report = await runChecks(terminal(working.script, working.files), plan);
    expect(report.ok).toBe(true);
    expect(report.facts).toMatchObject({
      account: "123456789012",
      region: "eu-central-1",
      stackId: "sd-gravity",
      immutableSubject: true,
    });
  });

  it("lists every problem in one go rather than one per run", async () => {
    // Nothing answers and nothing was named on the command line: every check must fail.
    const report = await runChecks(terminal({}, {}), { ...plan, region: undefined });
    expect(report.ok).toBe(false);
    expect(report.findings).toHaveLength(bootstrapChecks.length);
    expect(report.findings.filter(({ finding }) => finding.ok)).toEqual([]);
    // Every failure names a fix; that is the point of the whole command.
    expect(report.findings.every(({ finding }) => Boolean(finding.fix))).toBe(true);
  });

  it("keeps going when a check throws, and says so", async () => {
    const io = terminal(working.script, { ...working.files, "/talk/package.json": "{oops" });
    const report = await runChecks(io, plan);
    const esbuild = report.findings.find(({ check: entry }) => entry.id === "esbuild");
    expect(esbuild?.finding.ok).toBe(false);
    expect(report.findings).toHaveLength(bootstrapChecks.length);
  });
});
