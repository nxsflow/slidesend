import { definePresentation } from "@slidesend/core";
import { deck } from "./deck";
import { gravityDesign } from "./design";
import { gravityPlugin } from "./plugin";

export const presentation = definePresentation({
  deck,
  design: gravityDesign,
  plugins: [gravityPlugin],
});
