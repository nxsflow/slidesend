// A deliberately broken deck for the tests of `slidesend check`.
import { basics, defaultDesign, section } from "@slidesend/basics";
import { defineDeck, definePresentation } from "@slidesend/core";

export default definePresentation({
  deck: defineDeck({
    meta: { title: "Broken", language: "en" },
    chapters: [{ id: "intro", title: "Intro" }],
    slides: [
      section({ chapter: "outro", title: "In a chapter that does not exist" }),
      section({ chapter: "intro", title: "" }),
    ],
  }),
  design: defaultDesign,
  plugins: [basics()],
});
