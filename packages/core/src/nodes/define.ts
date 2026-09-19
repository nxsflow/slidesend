import type { ComponentType } from "react";
import type { z } from "zod";
import type {
  ActivityNode,
  BlockNode,
  BlockProps,
  Description,
  Messages,
  MonitorProps,
  NodeContext,
  NodeGroup,
  ParticipantProps,
  PrintProps,
  SlideNode,
  SlideProps,
} from "./types";

/** The schema of a node type's data. It must be a Zod object; core adds `type` to it. */
export type NodeSchema = z.ZodObject;

/** Fields every definition has, whatever its group. */
interface BaseOptions<Type extends string, Schema extends NodeSchema> {
  /** The node type, unique across all installed plugins, e.g. `"section"`. */
  type: Type;
  /** The Zod schema of the node's data, without `type` (and for slides without `chapter`, `id`). */
  schema: Schema;
}

/** Fields shared by slide templates and blocks, which both render on the stage. */
interface StageOptions<Type extends string, Schema extends NodeSchema>
  extends BaseOptions<Type, Schema> {
  /**
   * The node's step count, i.e. the number of clicks it takes on the stage. Defaults to 1.
   * A definition with `steps` must also define `describe`.
   */
  steps?: (data: z.output<Schema>, context: NodeContext) => number;
  /**
   * What core needs to know about the node: a label and one description per step. Defaults to
   * the `title` field (or the type) as label and one step built from the `stepMeta` fields at
   * the top level of the data.
   */
  describe?: (data: z.output<Schema>, context: NodeContext) => Description;
  /** How long a leaving node stays mounted to animate its exit, in ms. Defaults to the design's. */
  leaveMs?: number;
}

/** Everything `defineSlide` takes (spec §6.1). */
export interface SlideOptions<Type extends string, Schema extends NodeSchema>
  extends StageOptions<Type, Schema> {
  /** Renders the slide. It owns layout and every animation, including the first appearance. */
  Component: ComponentType<SlideProps<z.output<Schema>>>;
  /** Renders the slide on paper. Defaults to the last step, rendered statically. */
  Print?: ComponentType<PrintProps<z.output<Schema>>>;
}

/** Everything `defineBlock` takes (spec §6.2). */
export interface BlockOptions<Type extends string, Schema extends NodeSchema>
  extends StageOptions<Type, Schema> {
  /** Renders the block inside the slot of a slide template. */
  Component: ComponentType<BlockProps<z.output<Schema>>>;
  /** Renders the block on paper. Defaults to the last step, rendered statically. */
  Print?: ComponentType<PrintProps<z.output<Schema>>>;
}

/** Everything `defineActivity` takes (spec §6.4). */
export interface ActivityOptions<Type extends string, Schema extends NodeSchema>
  extends BaseOptions<Type, Schema> {
  /** Renders the activity on a phone. */
  Participant: ComponentType<ParticipantProps<z.output<Schema>>>;
  /** Renders a live tile in the desk while the activity runs. */
  Monitor?: ComponentType<MonitorProps<z.output<Schema>>>;
  /** The server half, keyed by platform name. Activities without one use core's response store. */
  server?: Readonly<Record<string, unknown>>;
}

/** The data a slide builder takes: the template's data plus `chapter` and an optional `id`. */
export type SlideInput<Schema extends NodeSchema> = z.input<Schema> & {
  /** The id of the chapter this slide belongs to. */
  chapter: string;
  /** A stable id. If missing, it is derived from chapter and position. */
  id?: string;
};

/** A slide template: its definition, callable as the typed builder used in a deck. */
export type SlideTemplate<Type extends string, Schema extends NodeSchema> = SlideOptions<
  Type,
  Schema
> & {
  readonly group: "slide";
  (data: SlideInput<Schema>): SlideNode<Type, z.input<Schema>>;
};

/** A block: its definition, callable as the typed builder used in a slot. */
export type BlockDefinition<Type extends string, Schema extends NodeSchema> = BlockOptions<
  Type,
  Schema
> & {
  readonly group: "block";
  (data: z.input<Schema>): BlockNode<Type, z.input<Schema>>;
};

/** An activity: its definition, callable as the typed builder attached to a step. */
export type ActivityDefinition<Type extends string, Schema extends NodeSchema> = ActivityOptions<
  Type,
  Schema
> & {
  readonly group: "activity";
  (data: z.input<Schema>): ActivityNode<Type, z.input<Schema>>;
};

// Collections of definitions forget each definition's data type. `any` is the only type that
// keeps a component for one data type assignable to such a collection.
// biome-ignore lint/suspicious/noExplicitAny: see above
type AnySchema = any;

/** A slide template of any type, as held by plugins and the registry. */
export type AnySlideTemplate = SlideTemplate<string, AnySchema>;
/** A block of any type, as held by plugins and the registry. */
export type AnyBlockDefinition = BlockDefinition<string, AnySchema>;
/** An activity of any type, as held by plugins and the registry. */
export type AnyActivityDefinition = ActivityDefinition<string, AnySchema>;
/** A definition of any group. */
export type AnyDefinition = AnySlideTemplate | AnyBlockDefinition | AnyActivityDefinition;

// Attaches the definition to its builder. Each define function states the precise type.
function withBuilder(group: NodeGroup, options: { type: string }): unknown {
  const build = (data: object) => ({ ...data, type: options.type });
  return Object.assign(build, options, { group });
}

/**
 * Defines a slide template (spec §6.1). The result is the definition a plugin lists and, called
 * as a function, the typed builder a deck uses: `section({ chapter: "intro", title: "..." })`.
 */
export function defineSlide<const Type extends string, Schema extends NodeSchema>(
  options: SlideOptions<Type, Schema>,
): SlideTemplate<Type, Schema> {
  return withBuilder("slide", options) as SlideTemplate<Type, Schema>;
}

/**
 * Defines a block (spec §6.2). The result is the definition a plugin lists and, called as a
 * function, the typed builder for a slot: `statement({ text: "..." })`.
 */
export function defineBlock<const Type extends string, Schema extends NodeSchema>(
  options: BlockOptions<Type, Schema>,
): BlockDefinition<Type, Schema> {
  return withBuilder("block", options) as BlockDefinition<Type, Schema>;
}

/**
 * Defines an activity (spec §6.4). The result is the definition a plugin lists and, called as a
 * function, the typed builder attached to a step: `poll({ id: "mood", ... })`.
 */
export function defineActivity<const Type extends string, Schema extends NodeSchema>(
  options: ActivityOptions<Type, Schema>,
): ActivityDefinition<Type, Schema> {
  return withBuilder("activity", options) as ActivityDefinition<Type, Schema>;
}

/** Everything `definePlugin` takes (spec §6.5). */
export interface PluginOptions<
  Slides extends readonly AnySlideTemplate[] = readonly AnySlideTemplate[],
> {
  /** The plugin's name, unique among the installed plugins. */
  name: string;
  /** Slide templates the plugin provides. */
  slides?: Slides;
  /** Blocks the plugin provides. */
  blocks?: readonly AnyBlockDefinition[];
  /** Activities the plugin provides. */
  activities?: readonly AnyActivityDefinition[];
  /**
   * Ids the plugin provides for references of other kinds than slides and activities, by kind,
   * e.g. `{ agent: ["raw", "advisor"] }` for `ref("agent")` fields.
   */
  provides?: Readonly<Record<string, readonly string[]>>;
  /** UI strings the plugin ships, by language. English is expected. */
  messages?: Messages;
  /** The plugin's server half, keyed by platform name. */
  server?: Readonly<Record<string, unknown>>;
}

/**
 * The installable unit: any number of nodes of all three groups (spec §6.5). `Slides` keeps the
 * slide templates' types, so that a presentation can check its deck against them.
 */
export interface Plugin<Slides extends readonly AnySlideTemplate[] = readonly AnySlideTemplate[]> {
  readonly name: string;
  readonly slides: Slides;
  readonly blocks: readonly AnyBlockDefinition[];
  readonly activities: readonly AnyActivityDefinition[];
  readonly provides: Readonly<Record<string, readonly string[]>>;
  readonly messages: Messages;
  readonly server: Readonly<Record<string, unknown>>;
}

/** The slide nodes the given plugins can build. */
export type SlideNodeOf<Plugins extends readonly Plugin[]> = ReturnType<
  Plugins[number]["slides"][number]
>;

/**
 * Defines a plugin (spec §6.5). Throws if a definition is listed under the wrong group, e.g. a
 * block under `slides`. Duplicate types across plugins are rejected by `createRegistry`.
 */
export function definePlugin<const Slides extends readonly AnySlideTemplate[] = []>(
  options: PluginOptions<Slides>,
): Plugin<Slides> {
  const plugin: Plugin<Slides> = {
    name: options.name,
    slides: options.slides ?? ([] as unknown as Slides),
    blocks: options.blocks ?? [],
    activities: options.activities ?? [],
    provides: options.provides ?? {},
    messages: options.messages ?? {},
    server: options.server ?? {},
  };
  const lists = [
    ["slides", "slide", plugin.slides],
    ["blocks", "block", plugin.blocks],
    ["activities", "activity", plugin.activities],
  ] as const;
  for (const [field, group, definitions] of lists) {
    for (const definition of definitions) {
      if (definition.group !== group) {
        throw new Error(
          `Plugin "${plugin.name}" lists the ${definition.group} "${definition.type}" under ${field}.`,
        );
      }
    }
  }
  return plugin;
}
