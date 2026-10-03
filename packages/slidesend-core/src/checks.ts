/**
 * The reusable browser checks (spec §16). Its own entry, because it imports `@playwright/test`:
 * a talk project uses it from a spec file, never from a bundle.
 */
export {
  type CheckOptions,
  currentSlide,
  defaultViewports,
  type LockCheckOptions,
  lockCheck,
  overflowChecks,
  settled,
  setVisible,
  stageChecks,
} from "./checks/browser";
export {
  measureOverflow,
  type OverflowFinding,
  overflowMessage,
  overflows,
  overflowTolerance,
  stepLink,
} from "./checks/overflow";
