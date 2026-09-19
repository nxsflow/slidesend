import { defineDeck } from "@slidesend/core";
import { points, title } from "./plugin";

/** "How does gravity work?", written for a school class that answers questions in between. */
export const deck = defineDeck({
  meta: { title: "How does gravity work?", language: "en", plannedMinutes: 20 },
  chapters: [
    { id: "intro", title: "Why things fall" },
    { id: "falling", title: "Falling together" },
  ],
  slides: [
    title({
      chapter: "intro",
      title: "How does gravity work?",
      subtitle: "A talk in which you answer too",
      minutes: 1,
    }),
    points({
      id: "everyday",
      chapter: "intro",
      title: "Things we see every day",
      items: [
        { text: "An apple drops from a tree.", minutes: 1 },
        { text: "The Moon circles the Earth.", minutes: 1 },
        { text: "The tides rise and fall.", minutes: 1 },
      ],
    }),
    title({ chapter: "falling", title: "Everything falls at the same rate", minutes: 2 }),
  ],
});
