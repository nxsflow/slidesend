/**
 * The command around the checks: what it prints, what it refuses, and — above all — that it
 * changes nothing until it is asked to.
 */
import { describe, expect, it } from "vitest";
import type { BootstrapIo } from "./checks";
import { bootstrap, planOf, reportLines, stackIdOf, workspaceRootOf } from "./command";

const files: Record<string, string> = {
  "/work/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
  "/work/package.json": '{"devDependencies":{"esbuild":"^0.28.2"}}',
  "/work/talks/gravity/package.json": '{"name":"gravity"}',
  "/work/talks/gravity/.blocks/config.json": '{"stackId":"sd-gravity"}',
};

const answers: Record<string, string> = {
  "sts get-caller-identity": '{"Account":"123456789012","Arn":"arn:aws:sts::1:x"}',
  "ssm get-parameter": '{"Parameter":{"Value":"26"}}',
  "repo view": "cabcookie/gravity",
  "gh api repos/cabcookie/gravity$":
    '{"id":1369593468,"name":"gravity","owner":{"login":"cabcookie","id":2454422}}',
  "customization/sub": '{"use_immutable_subject":true}',
  "environments/production$":
    '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}',
  "deployment-branch-policies": '{"branch_policies":[{"name":"main","type":"branch"}]}',
  "secret list": '[{"name":"AWS_DEPLOY_ROLE"},{"name":"AWS_REGION"}]',
  "list-open-id-connect-providers": '{"OpenIDConnectProviderList":[]}',
};

function io(overrides: { files?: Record<string, string>; answers?: Record<string, string> } = {}) {
  const all = { ...answers, ...overrides.answers };
  const content = { ...files, ...overrides.files };
  const ran: string[] = [];
  const reader: BootstrapIo = {
    async run(command, args) {
      const line = [command, ...args].join(" ");
      ran.push(line);
      const match = Object.entries(all)
        .filter(([pattern]) =>
          pattern.endsWith("$") ? line.endsWith(pattern.slice(0, -1)) : line.includes(pattern),
        )
        .sort(([a], [b]) => b.length - a.length)[0];
      return match
        ? { status: 0, stdout: match[1], stderr: "" }
        : { status: 127, stdout: "", stderr: "" };
    },
    read: (path) => content[path],
  };
  return { io: reader, ran };
}

function context(args: string[] = []) {
  const lines: string[] = [];
  return {
    context: { projectRoot: "/work/talks/gravity", args, log: (line: string) => lines.push(line) },
    lines,
  };
}

describe("slidesend bootstrap", () => {
  it("finds the workspace root above the talk, where esbuild has to live", () => {
    expect(workspaceRootOf("/work/talks/gravity", io().io)).toBe("/work");
    // A talk on its own is its own root; nothing above it declares a workspace.
    expect(workspaceRootOf("/elsewhere/talk", io().io)).toBe("/elsewhere/talk");
  });

  it("names the role after the stack, so its ARN is right in every remedy", () => {
    const { io: reader } = io();
    const { context: ctx } = context();
    expect(stackIdOf(reader, "/work/talks/gravity")).toBe("sd-gravity");
    expect(planOf(ctx, { io: reader }, "sd-gravity")).toMatchObject({
      workspaceRoot: "/work",
      environment: "production",
      roleName: "sd-gravity-deploy",
    });
  });

  it("takes profile, region, domain, environment and role from the command line", () => {
    const { context: ctx } = context([
      "--profile",
      "talks",
      "--region",
      "eu-central-1",
      "--domain",
      "talk.example.com",
      "--environment",
      "rehearsal",
      "--role",
      "own-name",
    ]);
    expect(planOf(ctx, { io: io().io })).toMatchObject({
      profile: "talks",
      region: "eu-central-1",
      domain: "talk.example.com",
      environment: "rehearsal",
      roleName: "own-name",
    });
  });

  it("reports a clean run and stops short of changing anything", async () => {
    const { io: reader, ran } = io();
    const { context: ctx, lines } = context(["--region", "eu-central-1"]);
    await bootstrap(ctx, { io: reader });
    expect(lines.join("\n")).toContain("Everything is in place.");
    expect(lines.join("\n")).toContain("slidesend bootstrap --deploy");
    // Read-only: no command that writes was run.
    expect(ran.every((line) => !/cdk deploy|secret set|--method/.test(line))).toBe(true);
  });

  it("fails with the list of what to do, in order", async () => {
    const { io: reader } = io({ answers: { "secret list": "" } });
    const { context: ctx, lines } = context(["--region", "eu-central-1"]);
    await expect(bootstrap(ctx, { io: reader })).rejects.toThrow("1 check(s) failed");
    const printed = lines.join("\n");
    expect(printed).toContain("TODO  the deploy secrets are set");
    expect(printed).toContain(
      "gh secret set AWS_DEPLOY_ROLE --env production --body arn:aws:iam::123456789012:role/sd-gravity-deploy",
    );
  });

  it("prints every check with its outcome", () => {
    const report = {
      ok: false,
      facts: {},
      findings: [
        {
          check: { id: "a", title: "one", run: async () => ({ ok: true, detail: "" }) },
          finding: { ok: true, detail: "fine" },
        },
        {
          check: { id: "b", title: "two", run: async () => ({ ok: true, detail: "" }) },
          finding: { ok: false, detail: "missing", fix: "do this" },
        },
      ],
    };
    expect(reportLines(report)).toEqual([
      "  ok    one: fine",
      "  TODO  two: missing",
      "",
      "  1 thing(s) to do, in this order:",
      "    two",
      "      do this",
    ]);
  });
});
