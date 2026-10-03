/**
 * The generated deploy workflow: where it is written, what it gates the deploy on, and that it
 * names no access key.
 */
import { describe, expect, it } from "vitest";
import { repositoryRootOf, type WorkflowIo, workflow, workflowInputOf } from "./command";
import { deployWorkflow } from "./template";

function repository(files: Record<string, string>) {
  const written: Record<string, string> = {};
  const io: WorkflowIo = {
    read: (path) => written[path] ?? files[path],
    exists: (path) => path in files || path in written,
    write: (path, content) => {
      written[path] = content;
    },
  };
  return { io, written };
}

/** How the workflow spells a secret, built so no linter mistakes it for a template. */
const actions = (name: string) => ["$", "{{ secrets.", name, " }}"].join("");

const monorepo = {
  "/repo/.git": "",
  "/repo/.nvmrc": "24",
  "/repo/pnpm-lock.yaml": "",
  "/repo/package.json": '{"scripts":{"check":"pnpm build && pnpm test"}}',
  "/repo/examples/gravity/package.json": '{"devDependencies":{"@playwright/test":"^1.63.0"}}',
};

describe("slidesend workflow", () => {
  it("finds the repository above the talk", () => {
    expect(repositoryRootOf("/repo/examples/gravity", repository(monorepo).io)).toBe("/repo");
    expect(repositoryRootOf("/elsewhere", repository(monorepo).io)).toBeUndefined();
  });

  it("gates the deploy on the repository's own check when the talk sits inside a workspace", () => {
    const input = workflowInputOf("/repo/examples/gravity", "/repo", repository(monorepo).io);
    expect(input).toEqual({
      talkDir: "examples/gravity",
      packageManager: "pnpm",
      rootCheck: true,
      playwright: true,
      nodeVersionFile: ".nvmrc",
      environment: "production",
      branch: "main",
    });
    const yaml = deployWorkflow(input);
    expect(yaml).toContain("      - run: pnpm check\n");
    expect(yaml).toContain(
      "      - run: pnpm exec playwright install --with-deps chromium\n        working-directory: examples/gravity",
    );
    expect(yaml).toContain(
      `      - run: pnpm exec slidesend deploy --region ${actions("AWS_REGION")}\n        working-directory: examples/gravity`,
    );
    expect(yaml.indexOf("pnpm check")).toBeLessThan(yaml.indexOf("configure-aws-credentials"));
  });

  it("checks with slidesend itself for a talk that is its own repository", () => {
    const files = {
      "/talk/.git": "",
      "/talk/package-lock.json": "",
      "/talk/package.json": '{"scripts":{"check":"slidesend check"}}',
    };
    const yaml = deployWorkflow(workflowInputOf("/talk", "/talk", repository(files).io));
    expect(yaml).toContain("      - run: npx slidesend check\n");
    expect(yaml).toContain("      - run: npm ci\n");
    expect(yaml).toContain("node-version: 24");
    expect(yaml).not.toContain("pnpm");
    expect(yaml).not.toContain("working-directory");
  });

  it("assumes the role through OIDC in the environment the trust policy names, and holds no key", () => {
    const yaml = deployWorkflow(
      workflowInputOf("/repo/examples/gravity", "/repo", repository(monorepo).io, [
        "--environment",
        "prod",
        "--branch",
        "release",
      ]),
    );
    expect(yaml).toContain("  id-token: write");
    expect(yaml).toContain("    environment: prod\n");
    expect(yaml).toContain("    branches: [release]");
    expect(yaml).toContain(`role-to-assume: ${actions("AWS_DEPLOY_ROLE")}`);
    expect(yaml).toContain("cancel-in-progress: false");
    expect(yaml).not.toMatch(/AWS_ACCESS_KEY_ID|aws-secret-access-key/i);
  });

  it("writes the file once and refuses to overwrite it without --force", async () => {
    const { io, written } = repository(monorepo);
    const lines: string[] = [];
    const ctx = (args: string[]) => ({
      projectRoot: "/repo/examples/gravity",
      args,
      log: (line: string) => lines.push(line),
    });
    await workflow(ctx([]), io);
    expect(Object.keys(written)).toEqual(["/repo/.github/workflows/deploy.yml"]);
    await expect(workflow(ctx([]), io)).rejects.toThrow("pass --force");
    await expect(workflow(ctx(["--force"]), io)).resolves.toBeUndefined();
  });
});
