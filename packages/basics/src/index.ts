/**
 * Browser entry of `@slidesend/basics`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
export const packageName = "@slidesend/basics";

export { qr } from "./blocks/qr";
export { RichText, richTextSyntax } from "./blocks/rich-text";
export {
  diff,
  image,
  list,
  quote,
  reveal,
  statement,
  timeline,
} from "./blocks/text-blocks";
export { defaultDesign } from "./design";
export { defaultTokens } from "./design-tokens";
export { basicsMessages } from "./messages";
export { basics } from "./plugin";
export { section, sectionMotionMs, sectionPosition } from "./section";
