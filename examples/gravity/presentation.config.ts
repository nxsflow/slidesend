import { basics } from "@slidesend/basics";
import { definePresentation } from "@slidesend/core";
import { deck } from "./src/deck";
import { gravityDesign } from "./src/design";
import { gravityPlugin } from "./src/plugin";

/** The example talk's configuration: deck, design and plugins, by explicit composition. */
export default definePresentation({
  deck,
  design: gravityDesign,
  plugins: [basics(), gravityPlugin],
});
