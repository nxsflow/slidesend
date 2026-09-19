/**
 * Browser entry of `@slidesend/basics`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
export const packageName = "@slidesend/basics";

export { defaultDesign } from "./design";
export { defaultTokens } from "./design-tokens";
export { basics } from "./plugin";
export { section, sectionMotionMs, sectionPosition } from "./section";
