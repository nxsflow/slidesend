/**
 * Server entry of `@slidesend/core`. Code that must not reach a browser bundle lives here: the
 * server logic written against the platform contract.
 */
export const packageName = "@slidesend/core";

export {
  type Access,
  accessOf,
  control,
  type Guards,
  open,
  type ServerApi,
  type ServerMethod,
  session,
} from "./server/api";
export { createDevBridge, type DevBridgeOptions, slidesendDev } from "./server/dev-bridge";
export {
  type CoreApi,
  createRuntime,
  createServer,
  maxResponsesPerDevice,
  maxStructuredResponseChars,
  presenceTtlMs,
  type ServerOptions,
  type SessionExport,
} from "./server/runtime";
export {
  controlSecretName,
  createSessions,
  limits,
  requireLength,
  type Sessions,
  type SessionsAccess,
  type SessionsOptions,
  sessionInputSchema,
  sessionPatchSchema,
} from "./server/sessions";
export {
  createMemoryPlatform,
  type MemoryConnection,
  type MemoryPlatform,
} from "./testing/memory-platform";
