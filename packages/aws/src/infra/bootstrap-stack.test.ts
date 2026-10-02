/**
 * What this stack is worth stands or falls with one string: the subject its trust policy
 * matches. A wrong one produces an STS error that looks exactly like an SCP denial, hours into
 * a first deployment, so the policy is asserted here in full rather than eyeballed there.
 */
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { BootstrapStack } from "./bootstrap-stack";
import { bootstrapInput } from "./input";
import { deploySubject } from "./subject";

const repository = { owner: "cabcookie", ownerId: 2454422, name: "gravity", id: 1369593468 };

function template(
  overrides: { domain?: string; existingProviderArn?: string; immutableSubject?: boolean } = {},
) {
  const app = new App();
  const stack = new BootstrapStack(app, "sd-gravity-bootstrap", {
    env: { account: "123456789012", region: "eu-central-1" },
    repository,
    environment: "production",
    roleName: "gravity-deploy",
    ...overrides,
  });
  return Template.fromStack(stack);
}

// Synthesizing a CDK stack takes a few seconds on its own, and more while the rest of
// `pnpm check` runs beside it; the default five seconds failed under that load.
describe("the bootstrap stack", { timeout: 30_000 }, () => {
  it("trusts exactly the immutable subject of the deployment environment", () => {
    const roles = Object.values(template().findResources("AWS::IAM::Role"));
    const deployRole = roles.find((role) => role.Properties?.RoleName === "gravity-deploy");
    expect(deployRole?.Properties?.AssumeRolePolicyDocument?.Statement).toEqual([
      {
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub":
              "repo:cabcookie@2454422/gravity@1369593468:environment:production",
          },
        },
        Effect: "Allow",
        Principal: { Federated: { Ref: expect.stringContaining("GitHubOidc") } },
      },
    ]);
    // No second condition key beside those two, in particular no `repository_owner`.
    expect(
      Object.keys(deployRole?.Properties?.AssumeRolePolicyDocument?.Statement[0].Condition ?? {}),
    ).toEqual(["StringEquals"]);
    expect(deployRole?.Properties?.MaxSessionDuration).toBe(7200);
  });

  it("builds the subject from the ids, not from the names", () => {
    expect(deploySubject(repository, "rehearsal")).toBe(
      "repo:cabcookie@2454422/gravity@1369593468:environment:rehearsal",
    );
  });

  it("follows a repository that switched immutable subjects off", () => {
    expect(deploySubject(repository, "production", false)).toBe(
      "repo:cabcookie/gravity:environment:production",
    );
    const roles = Object.values(
      template({ immutableSubject: false }).findResources("AWS::IAM::Role"),
    );
    const deployRole = roles.find((role) => role.Properties?.RoleName === "gravity-deploy");
    expect(
      deployRole?.Properties?.AssumeRolePolicyDocument?.Statement[0].Condition.StringEquals[
        "token.actions.githubusercontent.com:sub"
      ],
    ).toBe("repo:cabcookie/gravity:environment:production");
  });

  it("lets the role assume the CDK bootstrap roles and nothing else", () => {
    template().hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Resource: "arn:aws:iam::123456789012:role/cdk-hnb659fds-*-123456789012-*",
          },
          {
            Action: ["ssm:GetParameter", "ssm:GetParameters"],
            Effect: "Allow",
            Resource: "arn:aws:ssm:*:123456789012:parameter/cdk-bootstrap/hnb659fds/version",
          },
        ],
      },
    });
  });

  it("pins the measured thumbprints of GitHub's provider", () => {
    template().hasResourceProperties("Custom::AWSCDKOpenIdConnectProvider", {
      Url: "https://token.actions.githubusercontent.com",
      ClientIDList: ["sts.amazonaws.com"],
      ThumbprintList: [
        "6938fd4d98bab03faadb97b34396831e3780aea1",
        "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
      ],
    });
  });

  it("imports the provider of an account that already has one", () => {
    const imported = template({
      existingProviderArn:
        "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
    });
    expect(imported.findResources("Custom::AWSCDKOpenIdConnectProvider")).toEqual({});
  });

  it("creates the hosted zone and outputs its name servers only for a custom domain", () => {
    expect(template().findResources("AWS::Route53::HostedZone")).toEqual({});
    const withDomain = template({ domain: "talk.example.com" });
    withDomain.hasResourceProperties("AWS::Route53::HostedZone", { Name: "talk.example.com." });
    expect(Object.keys(withDomain.findOutputs("*"))).toContain("NameServers");
  });
});

describe("the app's input", () => {
  const complete = JSON.stringify({
    stackName: "sd-gravity-bootstrap",
    account: "123456789012",
    region: "eu-central-1",
    roleName: "gravity-deploy",
    environment: "production",
    repository,
  });

  it("reads what the command wrote", () => {
    expect(bootstrapInput(complete).repository.id).toBe(1369593468);
  });

  it.each([
    [undefined, "is not set"],
    ["{oops", "not valid JSON"],
    ['{"stackName":"x"}', 'missing "account"'],
    [JSON.stringify({ ...JSON.parse(complete), repository: undefined }), 'missing "repository"'],
  ])("explains %s", (raw, message) => {
    expect(() => bootstrapInput(raw)).toThrow(message);
  });
});
