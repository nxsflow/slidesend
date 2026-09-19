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
  definePresentation,
  type Presentation,
  type PresentationConfig,
  type ResolvedSlide,
} from "./deck/presentation";
export { chapterAccent, fontFaceCss, stageFrameProps, surfaceVariables } from "./design/css";
export {
  type ClosedPageProps,
  type ColorValues,
  type Design,
  type DesignTokens,
  defineDesign,
  type FontFile,
  type IdlePageProps,
  type PhoneFrameProps,
  type StageFrameProps,
  type StageProgress,
  type StartPageProps,
} from "./design/define";
export {
  accentVariable,
  accentVariableAt,
  type ColorToken,
  colorTokens,
  cssVariable,
  type FontToken,
  fontTokens,
  type RadiusToken,
  radiusTokens,
  type Surface,
  type TokenReference,
  tokenReference,
  tokenReferenceTable,
} from "./design/tokens";
export {
  createText,
  defineMessages,
  formatMessage,
  languageChain,
  type MessageProblem,
  messageKeys,
  type Text,
  type TextOptions,
} from "./messages/catalog";
export { coreMessages } from "./messages/core-messages";
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
export { type HttpPlatformClientOptions, httpPlatformClient } from "./platform/http-client";
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
export {
  clampStep,
  keyAction,
  type NavigationAction,
  type NavigationState,
  navigate,
  parseRoute,
  positionOf,
  type Route,
  type StageFit,
  stageFit,
  stageHeight,
  stageWidth,
  stepIndexOf,
} from "./stage/navigation";
export {
  backoffMs,
  browserEnvironment,
  type CursorTransport,
  type HostedTransportOptions,
  hostedTransport,
  type LocalTransportOptions,
  localTransport,
  pulseMs,
  type SyncEnvironment,
  sendDebounceMs,
} from "./sync/transport";
export {
  ActivityHost,
  type ActivityHostProps,
  type ActivityScope,
  useActivityScope,
  useResponseStore,
} from "./views/ActivityHost";
export { takeControlSecret } from "./views/access";
export { activityById, type VisibleActivity, visibleActivities } from "./views/activities";
export { Block, type BlockViewProps } from "./views/Block";
export { nodeData, PresentationContext, usePresentation, useText } from "./views/context";
export { deviceId } from "./views/device";
export { FitBox, type FitBoxProps } from "./views/FitBox";
export { type Navigation, type NavigationOptions, useNavigation, useStageFit } from "./views/hooks";
export { type MountOptions, mount, StageView, type StageViewProps } from "./views/mount";
export { PhoneView, type PhoneViewProps, sessionPollMs } from "./views/PhoneView";
export { defaultLeaveMs, SlideHost } from "./views/SlideHost";
export { Stage } from "./views/Stage";
export {
  joinUrl,
  SessionContext,
  type SessionInfo,
  useResponses,
  useSessionInfo,
} from "./views/session-context";
