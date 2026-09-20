// A deck that is valid and still does not fit: the render pass must say so, with slide and step.
import { basics, defaultDesign, list, section } from "@slidesend/basics";
import { defineDeck, definePresentation } from "@slidesend/core";

const tooMany = Array.from(
  { length: 24 },
  (_, index) =>
    `Point ${index + 1}: a line long enough to take a whole row of the stage by itself.`,
);

export default definePresentation({
  deck: defineDeck({
    meta: { title: "Too much", language: "en" },
    chapters: [{ id: "intro", title: "Intro" }],
    slides: [
      section({
        chapter: "intro",
        id: "overfull",
        title: "Everything at once",
        panels: [{ content: list({ items: tooMany }) }],
      }),
    ],
  }),
  design: defaultDesign,
  plugins: [basics()],
});
