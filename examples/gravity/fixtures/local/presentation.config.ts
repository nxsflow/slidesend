// A valid deck without a platform, for the tests of `slidesend`.
import { basics, defaultDesign, section } from "@slidesend/basics";
import { defineDeck, definePresentation } from "@slidesend/core";

export default definePresentation({
  deck: defineDeck({
    meta: { title: "Local only", language: "en" },
    chapters: [{ id: "intro", title: "Intro" }],
    slides: [section({ chapter: "intro", title: "Hello" })],
  }),
  design: defaultDesign,
  plugins: [basics()],
});
