import { section } from "@slidesend/basics";
import { defineDeck } from "@slidesend/core";
import { fact, sequence } from "./plugin";

/** "How does gravity work?", written for a school class that answers questions in between. */
export const deck = defineDeck({
  meta: { title: "How does gravity work?", language: "en", plannedMinutes: 20 },
  chapters: [
    { id: "intro", title: "Why things fall" },
    { id: "falling", title: "Falling together" },
  ],
  slides: [
    section({
      id: "why",
      chapter: "intro",
      title: "How does gravity work?",
      subtitle: "A talk in which you answer too",
      hero: true,
      notes: "Welcome the class.",
      minutes: 1,
      panels: [
        { content: fact({ text: "Everything falls." }), centered: true, minutes: 1 },
        {
          content: sequence({
            items: [
              { text: "An apple drops from a tree.", minutes: 1 },
              { text: "The Moon circles the Earth.", minutes: 1 },
              { text: "The tides rise and fall.", minutes: 1 },
            ],
          }),
        },
      ],
    }),
    section({
      chapter: "falling",
      title: "Everything falls at the same rate",
      panels: [
        { content: fact({ text: "A hammer and a feather, dropped together…" }), minutes: 1 },
        { content: fact({ text: "…land at the same moment on the Moon." }), minutes: 1 },
      ],
    }),
  ],
});
