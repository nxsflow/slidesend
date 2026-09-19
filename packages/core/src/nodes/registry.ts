import { z } from "zod";
import type { AnyDefinition, Plugin } from "./define";
import { type NodeIssue, type SlotResolver, withSlotResolver } from "./slots";
import type {
  Description,
  GroupNodes,
  Node,
  NodeContext,
  NodeGroup,
  StepDescription,
} from "./types";

/** Formats an issue path the way it is written in code, e.g. `panels[1].content.title`. */
export function formatNodePath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const key of path) {
    if (typeof key === "number") out += `[${key}]`;
    else out += out ? `.${String(key)}` : String(key);
  }
  return out;
}

/** Thrown when a node does not pass validation; `issues` holds every problem found. */
export class NodeValidationError extends Error {
  readonly issues: readonly NodeIssue[];

  constructor(issues: readonly NodeIssue[]) {
    const lines = issues.map(({ path, message }) =>
      path.length > 0 ? `${formatNodePath(path)}: ${message}` : message,
    );
    super(`Invalid node:\n${lines.map((line) => `  ${line}`).join("\n")}`);
    this.name = "NodeValidationError";
    this.issues = issues;
  }
}

/** The result of `Registry.safeParse`. */
export type NodeParseResult<Group extends NodeGroup> =
  | { ok: true; value: GroupNodes[Group] }
  | { ok: false; issues: NodeIssue[] };

/**
 * All node types of the installed plugins, and the operations that need them: validating a node
 * with everything nested in its slots, counting its steps and describing it.
 */
export interface Registry extends NodeContext {
  /** The installed plugins, in the order given. */
  readonly plugins: readonly Plugin[];
  /** The definition of a node type, whatever its group, or `undefined` if none is installed. */
  definition(type: string): AnyDefinition | undefined;
  /**
   * Validates a node of the given group, including every node in its slots, and returns it with
   * defaults applied. Throws a `NodeValidationError` listing every problem with its path.
   */
  parse<Group extends NodeGroup>(group: Group, node: unknown): GroupNodes[Group];
  /** Like `parse`, but returns the problems instead of throwing. */
  safeParse<Group extends NodeGroup>(group: Group, node: unknown): NodeParseResult<Group>;
}

/** Keys core adds to a node next to its type's data: `type` always, `chapter` and `id` on slides. */
const envelopeKeys: Record<NodeGroup, ReadonlySet<string>> = {
  slide: new Set(["type", "chapter", "id"]),
  block: new Set(["type"]),
  activity: new Set(["type"]),
};

const slideEnvelope = z.object({
  chapter: z.string().min(1),
  id: z.string().min(1).optional(),
});

const article: Record<NodeGroup, string> = {
  slide: "a slide",
  block: "a block",
  activity: "an activity",
};

/** The fields of `stepMeta` that the default `describe` reads from the top level of a node. */
const stepMetaKeys = ["notes", "cue", "minutes", "activity", "print"] as const;

function defaultDescription(type: string, data: Record<string, unknown>): Description {
  const step: Record<string, unknown> = {};
  for (const key of stepMetaKeys) {
    if (data[key] !== undefined) step[key] = data[key];
  }
  const label = typeof data.title === "string" && data.title ? data.title : type;
  return { label, steps: [step as StepDescription] };
}

/**
 * Builds the registry of the given plugins. Throws if two plugins share a name, if two
 * definitions share a node type (across all groups), or if a definition counts its own steps
 * without describing them.
 */
export function createRegistry(plugins: readonly Plugin[]): Registry {
  const owners = new Map<string, { definition: AnyDefinition; plugin: Plugin }>();
  const pluginNames = new Set<string>();

  for (const plugin of plugins) {
    if (pluginNames.has(plugin.name)) {
      throw new Error(`Two installed plugins are named "${plugin.name}".`);
    }
    pluginNames.add(plugin.name);
    for (const definition of [...plugin.slides, ...plugin.blocks, ...plugin.activities]) {
      const existing = owners.get(definition.type);
      if (existing) {
        throw new Error(
          `The node type "${definition.type}" is provided by both plugin "${existing.plugin.name}" and plugin "${plugin.name}".`,
        );
      }
      if (definition.group !== "activity" && definition.steps && !definition.describe) {
        throw new Error(
          `The ${definition.group} "${definition.type}" of plugin "${plugin.name}" defines steps but no describe.`,
        );
      }
      owners.set(definition.type, { definition, plugin });
    }
  }

  /** The data of every node this registry has parsed, without its envelope keys. */
  const parsedData = new WeakMap<object, Record<string, unknown>>();

  const resolver: SlotResolver = (group, node) => {
    const result = safeParse(group, node);
    return result.ok ? { ok: true, value: result.value } : result;
  };

  function safeParse<Group extends NodeGroup>(group: Group, node: unknown): NodeParseResult<Group> {
    if (typeof node !== "object" || node === null || typeof (node as Node).type !== "string") {
      return { ok: false, issues: [{ path: [], message: `Expected ${article[group]} node.` }] };
    }
    const { type } = node as Node;
    const definition = owners.get(type)?.definition;
    if (!definition) {
      const message = `No installed plugin provides the ${group} type "${type}".`;
      return { ok: false, issues: [{ path: ["type"], message }] };
    }
    if (definition.group !== group) {
      const message = `"${type}" is ${article[definition.group]}, not ${article[group]}.`;
      return { ok: false, issues: [{ path: ["type"], message }] };
    }

    const issues: NodeIssue[] = [];
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (!envelopeKeys[group].has(key)) data[key] = value;
    }

    let envelope: z.infer<typeof slideEnvelope> | undefined;
    if (group === "slide") {
      const result = slideEnvelope.safeParse(node);
      if (result.success) envelope = result.data;
      else issues.push(...result.error.issues.map(({ path, message }) => ({ path, message })));
    }

    const result = withSlotResolver(resolver, () => definition.schema.safeParse(data));
    if (!result.success) {
      issues.push(
        ...result.error.issues.map(({ path, message }: NodeIssue) => ({ path, message })),
      );
    }
    if (issues.length > 0 || !result.success) return { ok: false, issues };

    const output = result.data as Record<string, unknown>;
    const value = { type, ...envelope, ...output };
    parsedData.set(value, output);
    return { ok: true, value: value as unknown as GroupNodes[Group] };
  }

  function parse<Group extends NodeGroup>(group: Group, node: unknown): GroupNodes[Group] {
    const result = safeParse(group, node);
    if (!result.ok) throw new NodeValidationError(result.issues);
    return result.value;
  }

  /** The stage definition and parsed data of a slide or block node. */
  function stageNode(node: Node) {
    const definition = owners.get(node.type)?.definition;
    if (!definition) throw new Error(`No installed plugin provides the node type "${node.type}".`);
    if (definition.group === "activity") {
      throw new Error(`"${node.type}" is an activity; activities have no steps.`);
    }
    const data = parsedData.get(node) ?? parsedData.get(parse(definition.group, node));
    if (!data) throw new Error(`The node "${node.type}" could not be parsed.`);
    return { definition, data };
  }

  function stepsOf(node: Node): number {
    const { definition, data } = stageNode(node);
    const count = definition.steps ? definition.steps(data, context) : 1;
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(
        `steps of "${node.type}" returned ${count}; expected a whole number of at least 1.`,
      );
    }
    return count;
  }

  function describe(node: Node): Description {
    const { definition, data } = stageNode(node);
    const description = definition.describe
      ? definition.describe(data, context)
      : defaultDescription(definition.type, data);
    const count = stepsOf(node);
    if (description.steps.length !== count) {
      throw new Error(
        `describe of "${node.type}" returned ${description.steps.length} steps, but the node has ${count}.`,
      );
    }
    return description;
  }

  const context: NodeContext = { stepsOf, describe };

  return {
    plugins,
    definition: (type) => owners.get(type)?.definition,
    parse,
    safeParse,
    stepsOf,
    describe,
  };
}
