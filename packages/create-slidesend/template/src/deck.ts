import {
  diff,
  image,
  list,
  pollMatrix,
  qr,
  quote,
  reveal,
  section,
  statement,
  text,
  textList,
  timeline,
} from "@nxsflow/slidesend-basics";
import { defineDeck } from "@nxsflow/slidesend-core";
import { code } from "./plugin";

const yesOrNo = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

/**
 * The talk itself. It explains how it is made: every slide shows or describes the part of this
 * project that produces it. Change anything — the browser updates while you type.
 */
export const deck = defineDeck({
  meta: {
    title: "Your first Slidesend talk",
    subtitle: "It explains how it is made",
    language: "en",
    plannedMinutes: 18,
  },
  chapters: [
    { id: "start", title: "This talk" },
    { id: "files", title: "The project" },
    { id: "slides", title: "Slides and steps" },
    { id: "audience", title: "The audience" },
    { id: "look", title: "Your own look" },
    { id: "nodes", title: "Your own nodes" },
    { id: "next", title: "Next steps" },
  ],
  slides: [
    section({
      id: "welcome",
      chapter: "start",
      title: "Your first Slidesend talk",
      subtitle: "It explains how it is made",
      hero: true,
      notes: "Welcome. This talk is its own manual: read src/deck.ts next to it.",
      minutes: 0.5,
      panels: [
        {
          content: statement({
            text: "Everything you see comes from **this project's files** — open src/deck.ts.",
          }),
          centered: true,
          minutes: 0.5,
        },
        {
          content: image({
            src: "/how-it-fits.svg",
            alt: "The desk on your laptop steers the stage; phones follow the same session",
            caption: "The desk steers the stage; phones follow the same session.",
          }),
          notes: "Three views of one talk: stage (/stage), desk (/desk), phones (/).",
          minutes: 1,
        },
        {
          content: list({
            items: [
              "→ or space: next step · ←: previous step",
              "The desk shows notes, the cue, the next slide and the clock",
              "G in the desk jumps to any slide",
            ],
          }),
          minutes: 0.5,
        },
      ],
    }),
    section({
      id: "project",
      chapter: "files",
      title: "What is in the folder",
      panels: [
        {
          content: list({
            ordered: true,
            items: [
              "presentation.config.ts — puts deck, design and plugins together",
              "src/deck.ts — the slides, in TypeScript",
              "src/tokens.ts and src/design.tsx — colors, fonts, logo",
              "src/plugin.tsx — a node of this talk's own",
              "src/main.ts and index.html — mount the talk in the browser",
              "AGENTS.md — tells coding agents where the docs are",
            ],
          }),
          minutes: 1,
        },
        {
          content: code({
            file: "presentation.config.ts",
            region: "presentation",
            caption: "presentation.config.ts: exactly one design, any number of plugins",
          }),
          notes: "No folder is scanned, nothing registers itself: the config lists everything.",
          minutes: 1,
        },
      ],
    }),
    // snippet: this-slide
    section({
      id: "steps",
      chapter: "slides",
      title: "A slide is a node",
      panels: [
        {
          content: code({ file: "src/deck.ts", region: "this-slide", caption: "This very slide" }),
          notes: "Everything in a deck is a node: { type, ...data }. section() builds one.",
          minutes: 1,
        },
        {
          content: reveal({
            items: [
              { text: "Every click is a **step**", minutes: 0.3 },
              { text: "A step has notes, a cue and planned minutes", minutes: 0.3 },
              { text: "The desk adds the minutes up to a plan", minutes: 0.3 },
            ],
          }),
          cue: "Three clicks",
        },
      ],
    }),
    // end snippet
    section({
      id: "blocks",
      chapter: "slides",
      title: "Blocks from @nxsflow/slidesend-basics",
      panels: [
        {
          content: timeline({
            entries: [
              { label: "Write", text: "the deck in src/deck.ts" },
              { label: "Rehearse", text: "with a rehearsal session" },
              { label: "Present", text: "with phones in the room" },
            ],
          }),
          minutes: 0.5,
        },
        {
          content: diff({
            before: { label: "Before", text: "Slides in a file you click through" },
            after: { label: "After", text: "Slides in code you can review and reuse" },
          }),
          minutes: 0.5,
        },
        {
          content: quote({
            text: "The deck is checked when it loads: *a typo is an error, not a surprise on stage*.",
            source: "npm run check",
          }),
          minutes: 0.5,
        },
      ],
    }),
    section({
      id: "room",
      chapter: "audience",
      title: "Questions for the room",
      panels: [
        {
          content: statement({
            text: "Phones take part while a **session** is open. Open one in the desk under Prepare.",
            size: "medium",
          }),
          notes: "npm run dev starts the dev bridge, so phones on your network can join.",
          minutes: 0.5,
        },
        {
          content: qr({ caption: "Join on your phone" }),
          centered: true,
          cue: "Wait for phones",
          minutes: 1,
          print: {
            replaceWith: statement({ text: "Here the room joined on their phones." }),
          },
        },
        {
          // One node does both: it asks the phones and shows the answers on the stage.
          content: pollMatrix({
            id: "setup",
            message: "Two quick questions.",
            questions: [
              {
                id: "before",
                text: "Have you written slides in code before?",
                short: "Code before",
                options: yesOrNo,
              },
              {
                id: "deploy",
                text: "Will you put this talk online?",
                short: "Online",
                options: yesOrNo,
              },
            ],
          }),
          cue: "Let the matrix fill",
          minutes: 1,
          print: { text: "The room answered both questions; the matrix filled live." },
        },
        {
          // Asked here, shown on the next panel.
          activity: text({
            id: "topic",
            prompt: "What will your first talk be about?",
            message: "One line is enough.",
            multiple: true,
          }),
          content: statement({ text: "What will **your** first talk be about?" }),
          minutes: 1,
          print: { text: "The room wrote down the topics of their first talks." },
        },
        { content: textList({ of: "topic", limit: 6 }), minutes: 0.5 },
      ],
    }),
    section({
      id: "look",
      chapter: "look",
      title: "Your own look",
      panels: [
        {
          content: code({
            file: "src/tokens.ts",
            region: "colors",
            caption: "src/tokens.ts: change a color, and every slide follows",
          }),
          minutes: 1,
        },
        {
          content: code({
            file: "src/tokens.ts",
            region: "accents",
            caption: "Each chapter has its accent — see the bar at the bottom",
          }),
          minutes: 0.5,
        },
        {
          content: list({
            items: [
              "Tokens: colors, fonts, radii and one accent per chapter",
              "StageFrame: the logo and the progress bar around every slide",
              "PhoneFrame and three pages for the phones",
              "Replace public/logo.svg and public/logo-mark.svg with your own",
            ],
          }),
          notes: "The design is in src/design.tsx; the docs list every token.",
          minutes: 0.5,
        },
      ],
    }),
    section({
      id: "nodes",
      chapter: "nodes",
      title: "Your own nodes",
      panels: [
        {
          content: statement({
            text: "The code blocks in this talk are **not part of Slidesend**: src/plugin.tsx defines them.",
            size: "medium",
          }),
          minutes: 0.5,
        },
        // snippet: use-code-block
        {
          content: code({
            file: "src/plugin.tsx",
            region: "code-block",
            caption: "The block that shows this code",
          }),
          notes: "A type, a Zod schema, a React component. The plugin lists it; the deck calls it.",
          minutes: 1.5,
        },
        // end snippet
      ],
    }),
    section({
      id: "next",
      chapter: "next",
      title: "Next steps",
      panels: [
        {
          content: list({
            items: [
              "Change this deck: src/deck.ts",
              "npm run check — validates every slide",
              "npm run pdf — the talk and a storyboard on paper",
              "Put it online: @nxsflow/slidesend-aws, see docs/deploy-aws.md",
              "Ask a coding agent: AGENTS.md points it to the docs",
            ],
          }),
          notes: "All docs ship in node_modules/@nxsflow/slidesend-*/docs.",
          minutes: 1,
        },
      ],
    }),
  ],
});
