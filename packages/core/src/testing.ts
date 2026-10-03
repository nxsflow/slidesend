/**
 * Test helpers of `@slidesend/core` for consumers and plugin authors: the in-memory platform
 * that every server-logic test runs against, and the conformance suite every platform must pass.
 */
export type { ServerApi } from "./server/api";
export {
  conformanceApi,
  describePlatformConformance,
  type HarnessConnection,
  type PlatformHarness,
} from "./testing/conformance";
export {
  createMemoryPlatform,
  type MemoryClock,
  type MemoryConnection,
  type MemoryPlatform,
  type MemoryPlatformOptions,
} from "./testing/memory-platform";
export { plainDesign } from "./testing/plain-design";
export { type RecordedServer, recordWrites } from "./testing/write-recorder";
