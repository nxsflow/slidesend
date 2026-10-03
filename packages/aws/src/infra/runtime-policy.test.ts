import { App, Aspects, Stack } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { CfnRuntime } from "aws-cdk-lib/aws-bedrockagentcore";
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";
import { BootstrapStack } from "./bootstrap-stack";
import { NodeRuntimePolicy, nodeRuntime } from "./runtime-policy";

function stackWith(...runtimes: Runtime[]) {
  const app = new App();
  const stack = new Stack(app, "Talk");
  runtimes.forEach((runtime, index) => {
    new LambdaFunction(stack, `Fn${index}`, {
      runtime,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => {};"),
    });
  });
  Aspects.of(app).add(new NodeRuntimePolicy());
  return stack;
}

describe("the Node.js runtime policy", { timeout: 30_000 }, () => {
  it("moves every Node.js function to Node.js 24, whatever it was given", () => {
    const template = Template.fromStack(stackWith(Runtime.NODEJS_20_X, Runtime.NODEJS_22_X));
    const runtimes = Object.values(template.findResources("AWS::Lambda::Function")).map(
      (resource) => resource.Properties.Runtime,
    );
    expect(runtimes).toEqual([nodeRuntime, nodeRuntime]);
  });

  it("leaves a function in another language alone, and says so", () => {
    const stack = stackWith(Runtime.PYTHON_3_13);
    Template.fromStack(stack).hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "python3.13",
    });
    Annotations.fromStack(stack).hasWarning(
      "*",
      Match.stringLikeRegexp("runs on python3.13, not on Node.js 24"),
    );
  });

  it("names an AgentCore runtime that is not on Node.js 24", () => {
    const app = new App();
    const stack = new Stack(app, "Agent");
    new CfnRuntime(stack, "Runtime", {
      agentRuntimeName: "agent",
      roleArn: "arn:aws:iam::123456789012:role/agent",
      networkConfiguration: { networkMode: "PUBLIC" },
      agentRuntimeArtifact: {
        codeConfiguration: {
          code: { s3: { bucket: "assets", prefix: "agent.zip" } },
          runtime: "NODE_22",
          entryPoint: ["main.js"],
        },
      },
    });
    Aspects.of(app).add(new NodeRuntimePolicy());
    Annotations.fromStack(stack).hasWarning(
      "*",
      Match.stringLikeRegexp("runs on NODE_22, not on Node.js 24; AgentCore offers no Node.js 24"),
    );
  });

  it("keeps the bootstrap stack's own functions on Node.js 24", () => {
    const app = new App();
    const stack = new BootstrapStack(app, "sd-gravity-bootstrap", {
      env: { account: "123456789012", region: "eu-central-1" },
      repository: { owner: "cabcookie", ownerId: 2454422, name: "gravity", id: 1369593468 },
      environment: "production",
      roleName: "gravity-deploy",
    });
    Aspects.of(app).add(new NodeRuntimePolicy());
    const runtimes = Object.values(
      Template.fromStack(stack).findResources("AWS::Lambda::Function"),
    ).map((resource) => resource.Properties.Runtime);
    expect(runtimes.length).toBeGreaterThan(0);
    expect(new Set(runtimes)).toEqual(new Set([nodeRuntime]));
  });
});
