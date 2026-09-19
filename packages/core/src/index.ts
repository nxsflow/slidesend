/**
 * Browser entry of `@slidesend/core`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
export const packageName = "@slidesend/core";

export {
  type Chapter,
  chapterSchema,
  type Deck,
  defineDeck,
  type Meta,
  metaSchema,
} from "./deck/deck";
export {
  type DeckIssue,
  type DeckStep,
  DeckValidationError,
  type Design,
  definePresentation,
  type Platform,
  type Presentation,
  type PresentationConfig,
  type ResolvedSlide,
} from "./deck/presentation";
export {
  type ActivityDefinition,
  type ActivityOptions,
  type AnyActivityDefinition,
  type AnyBlockDefinition,
  type AnyDefinition,
  type AnySlideTemplate,
  type BlockDefinition,
  type BlockOptions,
  defineActivity,
  defineBlock,
  definePlugin,
  defineSlide,
  type NodeSchema,
  type Plugin,
  type PluginOptions,
  type SlideInput,
  type SlideNodeOf,
  type SlideOptions,
  type SlideTemplate,
} from "./nodes/define";
export {
  createRegistry,
  formatNodePath,
  type NodeParseResult,
  NodeValidationError,
  type ParseOptions,
  type Registry,
} from "./nodes/registry";
export {
  activityMeta,
  activityRef,
  activitySlot,
  blockSlot,
  type NodeIssue,
  printRule,
  type ReferenceCheck,
  ref,
  slideRef,
  stepMeta,
} from "./nodes/slots";
export type {
  ActivityNode,
  BlockNode,
  BlockProps,
  Description,
  FrameHints,
  GroupNodes,
  Messages,
  MonitorProps,
  Node,
  NodeContext,
  NodeGroup,
  ParticipantProps,
  PrintProps,
  PrintRule,
  SlideNode,
  SlideProps,
  StepDescription,
} from "./nodes/types";
