import { basics } from "@slidesend/basics";
import { definePresentation } from "@slidesend/core";
import { deck } from "./src/deck";
import { starterDesign } from "./src/design";
import { starterPlugin } from "./src/plugin";

// snippet: presentation
export default definePresentation({
  deck,
  design: starterDesign,
  // Every node type the deck uses comes from one of these plugins.
  plugins: [basics(), starterPlugin],
});
// end snippet
