import { aws } from "@slidesend/aws";
import { basics } from "@slidesend/basics";
import { definePresentation } from "@slidesend/core";
import { deck } from "./src/deck";
import { starterDesign } from "./src/design";
import { starterPlugin } from "./src/plugin";

// snippet: presentation
export default definePresentation({
  deck,
  design: starterDesign,
  // Where the talk is deployed; `npm run deploy` puts it there.
  platform: aws({ region: "eu-central-1" }),
  // Every node type the deck uses comes from one of these plugins.
  plugins: [basics(), starterPlugin],
});
// end snippet
