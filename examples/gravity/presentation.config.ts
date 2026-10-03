import { agent } from "@slidesend/agent";
import { aws } from "@slidesend/aws";
import { basics } from "@slidesend/basics";
import { definePresentation } from "@slidesend/core";
import { agents } from "./src/agents";
import { deck } from "./src/deck";
import { gravityDesign } from "./src/design";
import { gravityPlugin } from "./src/plugin";

/** The example talk's configuration: deck, design and plugins, by explicit composition. */
// snippet: presentation-config
export default definePresentation({
  deck,
  design: gravityDesign,
  platform: aws({ region: "eu-central-1" }),
  // The agent plugin is always installed, so the deck's `agent:` references are checked; whether
  // the chat appears is the deck's business (see `askNewton` in src/deck.ts).
  plugins: [basics(), gravityPlugin, agent({ agents })],
});
// end snippet
