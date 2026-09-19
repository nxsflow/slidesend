/**
 * Browser entry of `@slidesend/core`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
export const packageName = "@slidesend/core";

export {
  type CoreClient,
  type ResponseStore,
  type ResponseStoreOptions,
  responseStore,
  type TypedClient,
  typedClient,
} from "./client/client";
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
export {
  type Channel,
  type DeleteOptions,
  type ListOptions,
  maxValueBytes,
  type PlatformClient,
  PlatformDisconnectedError,
  type PlatformServer,
  type PutOptions,
  type Store,
  StoreConditionError,
  type StoreEntry,
  serializedBytes,
  splitListPrefix,
  splitStoreKey,
} from "./platform/contract";
export type {
  Platform,
  PlatformCommand,
  PlatformCommandContext,
} from "./platform/package";
export type { CoreApi } from "./server/runtime";
export { effectiveSession, openWindow, phonePage, plannedStartMs } from "./sessions/effective";
export {
  LimitError,
  NotAuthorizedError,
  SessionClosedError,
  SessionStateError,
} from "./sessions/errors";
export {
  type ActivityResponse,
  type Cursor,
  type CursorTarget,
  channels,
  type DeviceRole,
  heartbeatMs,
  type Presence,
  type PresenceEntry,
  type StepTiming,
} from "./sessions/runtime-types";
export type {
  PhonePage,
  PhoneSession,
  Session,
  SessionKind,
  SessionRecord,
  SessionState,
} from "./sessions/types";
