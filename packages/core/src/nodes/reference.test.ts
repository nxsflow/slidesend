import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineBlock, defineSlide } from "./define";
import { nodeReferenceTable, schemaFields } from "./reference";
import { activityMeta, blockSlot, stepMeta } from "./slots";

describe("schemaFields", () => {
  it("names types, required fields and defaults, and flattens nested objects", () => {
    const schema = z.object({
      title: z.string(),
      size: z.enum(["medium", "large"]).default("large"),
      count: z.number().optional(),
      panels: z.array(z.object({ content: blockSlot().optional(), ...stepMeta })),
      ...activityMeta,
    });
    const rows = schemaFields(schema);
    const row = (path: string) => rows.find((entry) => entry.path === path);
    expect(row("title")).toEqual({ path: "title", type: "string", required: true });
    expect(row("size")).toEqual({
      path: "size",
      type: '"medium" \\| "large"',
      required: false,
      default: '"large"',
    });
    expect(row("count")?.required).toBe(false);
    expect(row("panels")?.type).toBe("object[]");
    expect(row("panels[].content")?.type).toBe("block node");
    expect(row("panels[].activity")?.type).toBe("activity node");
    // A described shape is one row, not four.
    expect(row("panels[].print")?.type).toBe("print rule");
    expect(rows.some((entry) => entry.path.startsWith("panels[].print."))).toBe(false);
    expect(row("keep")?.type).toBe("true, or { until: slide id }");
  });
});

describe("nodeReferenceTable", () => {
  it("writes one table per node, with chapter and id for slides", () => {
    const Component = () => null;
    const note = defineBlock({ type: "note", schema: z.object({ text: z.string() }), Component });
    const plain = defineSlide({
      type: "plain",
      schema: z.object({ title: z.string() }),
      Component,
    });
    const table = nodeReferenceTable([plain, note]);
    expect(table).toContain("## `plain`\n\nA slide template.");
    expect(table).toContain("| `chapter` | chapter id | yes |  |");
    expect(table).toContain("## `note`\n\nA block.");
    expect(table).toContain("| `text` | string | yes |  |");
  });
});
