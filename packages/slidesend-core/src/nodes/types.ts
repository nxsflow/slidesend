/** The three node groups of spec §5.1. The group decides where a node may appear. */
export type NodeGroup = "slide" | "block" | "activity";

/**
 * Compile-time marker that tells node groups apart. It never exists at runtime; it only makes a
 * slide node unassignable to a block slot and the other way around.
 */
declare const groupMarker: unique symbol;

/** Any node: an object with a `type`, plus whatever data the type's schema allows (spec D5). */
export interface Node {
  readonly type: string;
}

/**
 * A slide node as it appears in `deck.slides`. Next to its template's data it carries the
 * chapter it belongs to and an optional stable id (spec §5).
 */
export type SlideNode<Type extends string = string, Data = unknown> = {
  readonly type: Type;
  chapter: string;
  id?: string;
} & Data & { readonly [groupMarker]?: "slide" };

/** A block node, rendered inside a slot that a slide template offers (spec §6.2). */
export type BlockNode<Type extends string = string, Data = unknown> = {
  readonly type: Type;
} & Data & { readonly [groupMarker]?: "block" };

/** An activity node, attached to a step and shown on the phones (spec §6.4). */
export type ActivityNode<Type extends string = string, Data = unknown> = {
  readonly type: Type;
} & Data & { readonly [groupMarker]?: "activity" };

/** The node type of each group. */
export interface GroupNodes {
  slide: SlideNode;
  block: BlockNode;
  activity: ActivityNode;
}

/**
 * Hints for the design's stage frame for one step, such as a large logo while a hero title is
 * centered (spec §6.3). Which keys a design reads is up to the design.
 */
export type FrameHints = Readonly<Record<string, unknown>>;

/**
 * How one step appears in print (spec §6.3). Without a rule, the step is printed as it is shown,
 * with nothing underneath.
 */
export interface PrintRule {
  /** Leave the step out of print, for anything that makes no sense without the room. */
  hide?: boolean;
  /**
   * Print this intermediate build step too. A slide that builds up over several clicks is
   * otherwise printed only in its final state.
   */
  keep?: boolean;
  /** A block printed instead of the step's own content, e.g. what a QR code points to. */
  replaceWith?: BlockNode;
  /** The text printed under the step. */
  text?: string;
}

/** What core, desk, phone, timing, print and storyboard know about one step (spec §6.3). */
export interface StepDescription {
  /** Speaker notes for this step. */
  notes?: string;
  /** A short, highlighted instruction for the speaker, such as "ask the room". */
  cue?: string;
  /** Planned duration of this step in minutes. */
  minutes?: number;
  /** The activity the phones show while this step runs. */
  activity?: ActivityNode;
  /** How this step appears in print. */
  print?: PrintRule;
  /** Hints for the design's stage frame. */
  frame?: FrameHints;
}

/** Everything outside a template needs to know about a node (spec §6.3). */
export interface Description {
  /** A short name for the jump overlay and the storyboard. */
  label: string;
  /** One entry per step, in order. Its length equals the node's step count. */
  steps: StepDescription[];
}

/**
 * Handed to `steps` and `describe`, so that a template can ask about the nodes in its slots
 * without knowing their types.
 */
export interface NodeContext {
  /** The step count of a nested node, e.g. a block that builds up over several clicks. */
  stepsOf(node: Node): number;
  /** The description of a nested node, e.g. to take over the activity a block contributes. */
  describe(node: Node): Description;
}

/** Props of a slide template's and a block's component (spec §6.1). */
export interface SlideProps<Data> {
  /** The node's data after validation, with defaults applied. */
  data: Data;
  /** The current step, starting at 0. */
  step: number;
  /** The step shown before this render, or `null` on the first appearance. */
  previousStep: number | null;
  /** Whether the presenter moved forward or backward to get here. */
  direction: "forward" | "backward";
  /**
   * Whether the node is appearing, fully present, or leaving. A leaving node stays mounted for
   * the time its template asks for (`leaveMs`), so it can animate its exit.
   */
  presence: "entering" | "present" | "leaving";
}

/** Props of a block's component; the same as a slide template's (spec §6.2). */
export type BlockProps<Data> = SlideProps<Data>;

/** Props of a print component, which renders a node statically on paper. */
export interface PrintProps<Data> {
  /** The node's data after validation, with defaults applied. */
  data: Data;
}

/** Props of an activity's phone component. */
export interface ParticipantProps<Data> {
  /** The activity's data after validation, with defaults applied. */
  data: Data;
}

/** Props of an activity's live tile in the desk. */
export interface MonitorProps<Data> {
  /** The activity's data after validation, with defaults applied. */
  data: Data;
}

/** UI strings by language code, then by message key (spec §6.5). */
export type Messages = Readonly<Record<string, Readonly<Record<string, string>>>>;
