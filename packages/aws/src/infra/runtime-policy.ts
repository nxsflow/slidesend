/**
 * Every Lambda a talk deploys runs on Node.js 24, whatever runtime a library picks by default:
 * AWS Blocks and the CDK choose their own, and a default can change under a minor release.
 *
 * Applied to both CDK apps of this package as an aspect, so it reaches functions created deep
 * inside constructs we do not own. A function on another language is left alone — the CDK's
 * BucketDeployment, which copies the site to S3, is Python and has no Node.js equivalent — and
 * named in a warning, so an exception is visible in every synth instead of being found later.
 * The same holds for the AgentCore runtime of an agent: AgentCore offers no Node.js 24 yet.
 */
import { Annotations, type IAspect, Token } from "aws-cdk-lib";
import { CfnRuntime } from "aws-cdk-lib/aws-bedrockagentcore";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";
import type { IConstruct } from "constructs";

/** The Lambda runtime every Node.js function gets. */
export const nodeRuntime = "nodejs24.x";

export class NodeRuntimePolicy implements IAspect {
  visit(node: IConstruct): void {
    if (node instanceof CfnRuntime) {
      const artifact = node.agentRuntimeArtifact as { codeConfiguration?: { runtime?: unknown } };
      const runtime = artifact.codeConfiguration?.runtime;
      if (typeof runtime === "string" && runtime !== "NODE_24") {
        Annotations.of(node).addWarningV2(
          "@slidesend/aws:runtime",
          `${node.node.path} runs on ${runtime}, not on Node.js 24; AgentCore offers no Node.js 24 runtime yet.`,
        );
      }
      return;
    }
    if (!(node instanceof CfnFunction)) return;
    const runtime = node.runtime;
    // A container image has no runtime; a token is resolved elsewhere and cannot be read here.
    if (!runtime || Token.isUnresolved(runtime)) return;
    if (runtime.startsWith("nodejs")) {
      node.runtime = nodeRuntime;
      return;
    }
    Annotations.of(node).addWarningV2(
      "@slidesend/aws:runtime",
      `${node.node.path} runs on ${runtime}, not on Node.js 24; it comes from a library and has no Node.js variant.`,
    );
  }
}
