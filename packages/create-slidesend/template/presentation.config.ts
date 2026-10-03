import { basics } from "@nxsflow/slidesend-basics";
import { definePresentation } from "@nxsflow/slidesend-core";
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
