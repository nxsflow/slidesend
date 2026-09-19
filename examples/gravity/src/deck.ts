import {
  diff,
  image,
  list,
  qr,
  quote,
  reveal,
  section,
  statement,
  timeline,
} from "@slidesend/basics";
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
        {
          content: statement({ text: "Everything falls — **even the Moon**." }),
          centered: true,
          minutes: 1,
        },
        {
          content: qr({ caption: "Answer on your phone" }),
          centered: true,
          cue: "Wait for phones",
        },
        {
          content: list({
            items: [
              "An apple drops from a tree.",
              "The Moon circles the Earth.",
              "The tides rise and fall.",
            ],
          }),
          minutes: 2,
        },
      ],
    }),
    section({
      id: "observations",
      chapter: "intro",
      title: "How the idea grew",
      panels: [
        {
          content: timeline({
            entries: [
              { label: "1609", text: "Kepler describes the paths of the planets." },
              { label: "1687", text: "Newton writes one law for apple and Moon." },
              { label: "1915", text: "Einstein makes space itself bend." },
            ],
          }),
          minutes: 2,
        },
        {
          content: image({
            src: "/apple-and-feather.svg",
            alt: "An apple and a feather falling side by side",
            caption: "Dropped together, they land together — if the air stays out of it.",
          }),
          minutes: 1,
        },
      ],
    }),
    section({
      chapter: "falling",
      title: "Everything falls at the same rate",
      panels: [
        {
          content: diff({
            before: { label: "On Earth", text: "The feather drifts; the air holds it back." },
            after: { label: "On the Moon", text: "Both land at the same moment." },
            number: { value: "1.6", caption: "m/s² on the Moon" },
          }),
          minutes: 2,
        },
        {
          content: quote({
            text: "How different things fall is a question about the air, *not* about weight.",
            source: "What the experiment shows",
          }),
          minutes: 1,
        },
      ],
    }),
    section({
      id: "together",
      chapter: "falling",
      title: "What to remember",
      panels: [
        {
          content: reveal({
            items: [
              { text: "Gravity pulls **everything** towards everything.", minutes: 1 },
              { text: "Heavier does not mean faster.", minutes: 1 },
              { text: "The Moon is falling too — it keeps missing the Earth.", minutes: 1 },
            ],
          }),
        },
        { content: fact({ text: "So: you are falling as well." }), minutes: 1 },
        {
          content: sequence({
            items: [{ text: "Ask your own question." }, { text: "Then look it up together." }],
          }),
          minutes: 2,
        },
      ],
    }),
  ],
});
