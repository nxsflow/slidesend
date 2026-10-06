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
} from "@slidesend/basics";
import { defineDeck } from "@slidesend/core";
import { code } from "./plugin";

const yesOrNo = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

/**
 * The talk itself. It explains how it is made: every slide shows or describes the part of this
 * project that produces it. Change anything — or ask your coding agent to — and the browser
 * updates while you type.
 */
export const deck = defineDeck({
  meta: {
    title: "Your first slidesend talk",
    subtitle: "Written with your AI agent — and it explains how it is made",
    language: "en",
    plannedMinutes: 20,
  },
  chapters: [
    { id: "start", title: "This talk" },
    { id: "agents", title: "Built for your AI agent" },
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
      title: "Your first slidesend talk",
      subtitle: "Written with your AI agent — and it explains how it is made",
      hero: true,
      notes:
        "Welcome. This talk is its own manual: everything on these slides comes from the files in this folder, and the desk shows you these notes while you speak.",
      minutes: 0.5,
      panels: [
        {
          content: statement({
            text: "Everything you see comes from **this project's files** — open src/deck.ts.",
          }),
          centered: true,
          notes:
            "Open src/deck.ts next to the browser. Each section of this talk is one call in that file.",
          minutes: 0.5,
        },
        {
          content: image({
            src: "/how-it-fits.svg",
            alt: "The desk on your laptop steers the stage; phones follow the same session",
            caption: "The desk steers the stage; phones follow the same session.",
          }),
          notes:
            "Three views of one talk: the stage on the projector, this desk on your laptop, and the phones of the audience. They all follow the same session.",
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
          notes:
            "The keyboard is all you need. A presenter remote works too, because it sends the same keys.",
          minutes: 0.5,
        },
      ],
    }),
    section({
      id: "agent",
      chapter: "agents",
      title: "Built for your AI agent",
      notes:
        "This is the point of slidesend: you describe the talk, and a coding agent writes and fixes the slides with you.",
      panels: [
        {
          content: statement({
            text: "slidesend is made to be written **together with an AI coding agent**.",
          }),
          centered: true,
          notes:
            "A talk here is a small TypeScript project. Coding agents are good at exactly that, so let one do the typing.",
          minutes: 0.5,
        },
        {
          content: list({
            items: [
              "AGENTS.md tells the agent where the docs are: in node_modules, for your version",
              "Every slide is TypeScript, checked by types as the agent writes it",
              "npm run check names every mistake by slide and field — the agent fixes it",
              "npm run check:render finds a slide that does not fit the stage",
            ],
          }),
          notes:
            "Four things make an agent reliable here: the docs ship with the packages, the deck is typed, and two checks tell it precisely what is wrong.",
          minutes: 1,
        },
        {
          content: code({
            file: "AGENTS.md",
            caption: "AGENTS.md: what your agent reads first",
          }),
          notes:
            "Most coding agents read AGENTS.md on their own. This one points them to the documentation of the exact version you installed.",
          minutes: 1,
        },
        {
          content: quote({
            text: "Add a slide after “Questions for the room” with a poll: which part of this talk was new to you?",
            source: "Try it: type this into your coding agent",
          }),
          cue: "Show it live, if you can",
          notes:
            "Open this folder in your coding agent and ask for a change like this one. Then watch the browser update.",
          minutes: 1,
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
          notes:
            "A handful of files. You will mostly work in src/deck.ts, sometimes in the design, rarely anywhere else.",
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
              {
                text: "Every click is a **step**",
                notes: "One click, one step. The section moves on panel by panel.",
                minutes: 0.3,
              },
              {
                text: "A step has notes, a cue and planned minutes",
                notes: "These notes are the speaker notes of exactly this step.",
                minutes: 0.3,
              },
              {
                text: "The desk adds the minutes up to a plan",
                notes: "The clock in the desk compares where you are with that plan.",
                minutes: 0.3,
              },
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
      title: "Blocks from @slidesend/basics",
      panels: [
        {
          content: timeline({
            entries: [
              { label: "Write", text: "the deck in src/deck.ts" },
              { label: "Rehearse", text: "with a rehearsal session" },
              { label: "Present", text: "with phones in the room" },
            ],
          }),
          notes:
            "A timeline is one of the blocks that come with slidesend. You fill in data; the block does the layout.",
          minutes: 0.5,
        },
        {
          content: diff({
            before: { label: "Before", text: "Slides in a file you click through" },
            after: { label: "After", text: "Slides in code you can review and reuse" },
          }),
          notes:
            "A before-and-after comparison. Code can be reviewed, reused and changed by an agent; a slide file cannot.",
          minutes: 0.5,
        },
        {
          content: quote({
            text: "The deck is checked when it loads: *a typo is an error, not a surprise on stage*.",
            source: "npm run check",
          }),
          notes:
            "Every block checks its own data. A mistake shows up while you write, not in front of the audience.",
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
            text: "Phones take part while a **session** is open. The desk opens one with a single click.",
            size: "medium",
          }),
          notes:
            "On the desk's start page, Rehearse or Go live opens a session. Phones can only answer while it is open.",
          minutes: 0.5,
        },
        {
          content: qr({ caption: "Join on your phone" }),
          centered: true,
          cue: "Wait for phones",
          notes:
            "Give the room a moment to scan the code. The desk counts the phones that joined, in its header.",
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
          notes:
            "The phones show both questions; the stage fills the matrix as answers come in. Comment on it once it settles.",
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
          notes: "A free-text question. The answers appear on the next step.",
          minutes: 1,
          print: { text: "The room wrote down the topics of their first talks." },
        },
        {
          content: textList({ of: "topic", limit: 6 }),
          notes: "Read two or three of them out loud.",
          minutes: 0.5,
        },
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
          notes:
            "The design is a list of named values. Change one color here and every slide and every phone follows.",
          minutes: 1,
        },
        {
          content: code({
            file: "src/tokens.ts",
            region: "accents",
            caption: "Each chapter has its accent — see the bar at the bottom",
          }),
          notes:
            "One accent color per chapter. Watch the progress bar change color between chapters.",
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
            text: "The code blocks in this talk are **not part of slidesend**: src/plugin.tsx defines them.",
            size: "medium",
          }),
          notes:
            "When the blocks that come with slidesend are not enough, you write your own — or your agent does.",
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
              "Ask your coding agent for the talk you want to give",
              "npm run check — validates every slide",
              "npm run pdf — the talk and a storyboard on paper",
              "Put it online: @slidesend/aws, see docs/deploy-aws.md",
            ],
          }),
          notes:
            "Start by telling your agent what your talk is about. All docs ship in node_modules/@slidesend/*/docs, and AGENTS.md points there.",
          minutes: 1,
        },
      ],
    }),
  ],
});
