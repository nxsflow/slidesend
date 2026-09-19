import { z } from "zod";
import type { ActivityNode, BlockNode, GroupNodes, NodeGroup } from "./types";

/** One problem found while validating a node, with its path relative to the node. */
export interface NodeIssue {
  path: PropertyKey[];
  message: string;
}

/** Validates a nested node against its type's schema; supplied by the registry during a parse. */
export type SlotResolver = (
  group: NodeGroup,
  node: unknown,
) => { ok: true; value: object } | { ok: false; issues: NodeIssue[] };

let activeResolver: SlotResolver | undefined;

/**
 * Runs `parse` with `resolver` validating every slot it meets. Parsing is synchronous, so the
 * resolver of the parse in progress is simply the active one; nested parses restore the outer.
 */
export function withSlotResolver<T>(resolver: SlotResolver, parse: () => T): T {
  const outer = activeResolver;
  activeResolver = resolver;
  try {
    return parse();
  } finally {
    activeResolver = outer;
  }
}

function isNodeLike(value: unknown): value is { type: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function slot<Group extends NodeGroup>(group: Group) {
  return z
    .custom<GroupNodes[Group]>(isNodeLike, { message: `Expected a ${group} node.` })
    .transform((node, context) => {
      if (!activeResolver) {
        context.addIssue({
          code: "custom",
          message: `A ${group} slot can only be validated through createRegistry(...).parse().`,
        });
        return z.NEVER;
      }
      const result = activeResolver(group, node);
      if (!result.ok) {
        for (const issue of result.issues) {
          context.addIssue({ code: "custom", message: issue.message, path: issue.path });
        }
        return z.NEVER;
      }
      return result.value as GroupNodes[Group];
    });
}

/**
 * A slot for one block (spec §6.1). It accepts a block of any installed plugin and validates it
 * against that block's schema. Use `.optional()` for a slot that may stay empty.
 */
export function blockSlot(): z.ZodType<BlockNode, BlockNode> {
  return slot("block");
}

/** A slot for one activity. It accepts an activity of any installed plugin. */
export function activitySlot(): z.ZodType<ActivityNode, ActivityNode> {
  return slot("activity");
}

/** The print rule of one step (spec §6.3); see `PrintRule`. */
export const printRule = z.object({
  hide: z.boolean().optional(),
  keep: z.boolean().optional(),
  replaceWith: blockSlot().optional(),
  text: z.string().optional(),
});

/**
 * The fields of one step, to spread wherever steps originate: on each panel of a section, on
 * each item of a reveal list, or at the top level of a single-step node (spec §6.3).
 *
 * ```ts
 * panels: z.array(z.object({ content: blockSlot().optional(), ...stepMeta }))
 * ```
 */
export const stepMeta = {
  /** Speaker notes for this step. */
  notes: z.string().optional(),
  /** A short, highlighted instruction for the speaker. */
  cue: z.string().optional(),
  /** Planned duration of this step in minutes. */
  minutes: z.number().nonnegative().optional(),
  /** The activity the phones show while this step runs. */
  activity: activitySlot().optional(),
  /** How this step appears in print. */
  print: printRule.optional(),
};

/**
 * The fields every activity has, to spread into its schema (spec §6.4).
 *
 * ```ts
 * schema: z.object({ id: z.string(), questions, ...activityMeta })
 * ```
 */
export const activityMeta = {
  /** One sentence of context for the phone, which does not show the slide. */
  message: z.string().optional(),
  /**
   * Keeps the activity available after its step: `true` for the rest of the talk, or until the
   * slide with the given id.
   */
  keep: z.union([z.literal(true), z.object({ until: z.string().min(1) })]).optional(),
};
