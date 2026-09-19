/**
 * Test helpers of `@slidesend/core` for consumers and plugin authors: the in-memory platform
 * that every server-logic test runs against, and the conformance suite every platform must pass.
 */
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
  type ServerApi,
} from "./testing/memory-platform";
