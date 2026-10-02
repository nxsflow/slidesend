import { join } from "node:path";
import { expect, it } from "vitest";
import { agent } from "../packages/agent/src/index";
import { aws } from "../packages/aws/src/index";
import { basics } from "../packages/basics/src/index";
import { platformCommandTable } from "../packages/core/src/cli/commands";
import { type AnyDefinition, nodeReferenceTable, type Plugin } from "../packages/core/src/index";
import { committed, generatedDocument } from "./generated-docs";

const packages = join(import.meta.dirname, "..", "packages");
const nodesOf = (plugin: Plugin): AnyDefinition[] => [
  ...plugin.slides,
  ...plugin.blocks,
  ...plugin.activities,
];

// The schema field tables per node (spec §15, check 3), generated from the schemas themselves.
it("keeps packages/basics/docs/nodes.md in step with the schemas", () => {
  const expected = generatedDocument(
    "The nodes of @slidesend/basics",
    nodeReferenceTable(nodesOf(basics())),
    "Every field of every node, from its schema. How to use them: [writing-slides](../../core/docs/writing-slides.md#the-nodes-of-slidesendbasics).",
  );
  expect(committed(join(packages, "basics", "docs", "nodes.md"), expected)).toBe(expected);
});

it("keeps packages/agent/docs/nodes.md in step with the schema", () => {
  const plugin = agent({ agents: { example: { systemPrompt: "-" } } });
  const expected = generatedDocument(
    "The nodes of @slidesend/agent",
    nodeReferenceTable(nodesOf(plugin)),
    "Every field of the agent chat, from its schema. How to use it: [agents](agents.md).",
  );
  expect(committed(join(packages, "agent", "docs", "nodes.md"), expected)).toBe(expected);
});

it("keeps packages/aws/docs/commands.md in step with the commands", () => {
  const expected = generatedDocument(
    "The commands of @slidesend/aws",
    platformCommandTable(aws({ region: "eu-central-1" })),
    "What `aws()` adds to `slidesend`. Every command takes `--profile <name>`; see [deploy-aws](deploy-aws.md).",
  );
  expect(committed(join(packages, "aws", "docs", "commands.md"), expected)).toBe(expected);
});
