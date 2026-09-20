/**
 * Print is a selection, and these are the rules that make it. Each of the four is tested on its
 * own, and the honesty check is tested from both sides: it must fire where a page would lie, and
 * stay quiet where the author has already decided what paper shows.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineDeck } from "../deck/deck";
import { definePresentation } from "../deck/presentation";
import { defineBlock, definePlugin, defineSlide } from "../nodes/define";
import { blockSlot, stepMeta } from "../nodes/slots";
import { plainDesign } from "../testing/plain-design";
import { printProblemMessage, printProblems, printSteps, storyboard } from "./rules";

const text = defineBlock({
  type: "words",
  schema: z.object({ text: z.string() }),
  Component: () => null,
});

/** A block that only works while the room is there, e.g. a code someone scans. */
const code = defineBlock({
  type: "code",
  schema: z.object({ caption: z.string().optional() }),
  Component: () => null,
  liveOnly: true,
});

/** A slide of several panels, each its own step — the shape print has to thin out. */
const panels = defineSlide({
  type: "panels",
  schema: z.object({
    title: z.string(),
    panels: z.array(z.object({ content: blockSlot(), ...stepMeta })),
  }),
  steps: (data) => data.panels.length,
  describe: (data) => ({
    label: data.title,
    steps: data.panels.map((panel) => ({
      ...(panel.notes ? { notes: panel.notes } : {}),
      ...(panel.cue ? { cue: panel.cue } : {}),
      ...(panel.minutes !== undefined ? { minutes: panel.minutes } : {}),
      ...(panel.activity ? { activity: panel.activity } : {}),
      ...(panel.print ? { print: panel.print } : {}),
    })),
  }),
  Component: () => null,
});

const ask = {
  type: "ask",
  id: "mood",
} as const;

const plugin = definePlugin({
  name: "test",
  slides: [panels],
  blocks: [text, code],
  activities: [
    {
      type: "ask",
      schema: z.object({ id: z.string() }),
      group: "activity",
      Participant: () => null,
    } as never,
  ],
});

function talk(slides: unknown[]) {
  const deck = defineDeck({
    meta: { title: "On paper", language: "en" },
    chapters: [{ id: "main", title: "Main" }],
    slides: slides as never,
  });
  return definePresentation({ deck: deck as never, design: plainDesign, plugins: [plugin] });
}

const panel = (content: unknown, extra: object = {}) => ({ content, ...extra });
const words = (value: string) => ({ type: "words", text: value });

describe("what goes on paper", () => {
  it("prints a slide's last step, not every click of its build-up", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "build",
        title: "Building up",
        panels: [panel(words("one")), panel(words("two")), panel(words("three"))],
      },
    ]);
    expect(printSteps(presentation).map((page) => page.index)).toEqual([2]);
  });

  it("keeps an intermediate step when it is asked to", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "build",
        title: "Building up",
        panels: [
          panel(words("one"), { print: { keep: true } }),
          panel(words("two")),
          panel(words("three")),
        ],
      },
    ]);
    expect(printSteps(presentation).map((page) => page.index)).toEqual([0, 2]);
  });

  it("prints a step that was given a replacement or a text of its own", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "build",
        title: "Building up",
        panels: [
          panel({ type: "code" }, { print: { replaceWith: words("the address") } }),
          panel(words("two"), { print: { text: "What the room did here." } }),
          panel(words("three")),
        ],
      },
    ]);
    // Otherwise the author would write a rule that is silently dropped.
    expect(printSteps(presentation).map((page) => page.index)).toEqual([0, 1, 2]);
  });

  it("hides a step, and takes the last visible one instead", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "build",
        title: "Building up",
        panels: [
          panel(words("one")),
          panel(words("two")),
          panel(words("three"), { print: { hide: true } }),
        ],
      },
    ]);
    expect(printSteps(presentation).map((page) => page.index)).toEqual([1]);
  });

  it("prints nothing for a slide whose every step is hidden", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "gone",
        title: "Only live",
        panels: [panel(words("one"), { print: { hide: true } })],
      },
    ]);
    expect(printSteps(presentation)).toEqual([]);
  });

  it("puts another block in a step's place, and its own text under it", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "qr",
        title: "Join in",
        panels: [
          panel(
            { type: "code" },
            {
              notes: "Wait for the phones.",
              print: {
                replaceWith: words("slidesend.example/r/abc"),
                text: "The address the code showed.",
              },
            },
          ),
        ],
      },
    ]);
    const [page] = printSteps(presentation);
    expect(page?.replaceWith).toMatchObject({ type: "words", text: "slidesend.example/r/abc" });
    // `text` replaces the notes under the slide; it does not join them.
    expect(page?.text).toBe("The address the code showed.");
  });

  it("prints the notes under a step that has no text of its own", () => {
    const presentation = talk([
      {
        type: "panels",
        chapter: "main",
        id: "plain",
        title: "Plain",
        panels: [panel(words("one"), { notes: "Say this." })],
      },
    ]);
    expect(printSteps(presentation)[0]?.text).toBe("Say this.");
  });
});

describe("the storyboard", () => {
  const presentation = talk([
    {
      type: "panels",
      chapter: "main",
      id: "one",
      title: "First",
      panels: [
        panel(words("a"), { notes: "Open with the apple.", minutes: 1, cue: "Ask the room" }),
        panel(words("b"), { notes: "Then the Moon.", minutes: 2 }),
      ],
    },
    {
      type: "panels",
      chapter: "main",
      id: "two",
      title: "Second",
      panels: [panel(words("c"), { minutes: 0.5 })],
    },
  ]);

  it("is one entry per slide, with everything the speaker says to it", () => {
    const board = storyboard(presentation);
    expect(board).toHaveLength(2);
    expect(board[0]).toMatchObject({
      stepCount: 2,
      minutes: 3,
      notes: ["Open with the apple.", "Then the Moon."],
      cues: ["Ask the room"],
    });
    expect(board[0]?.step?.index).toBe(1);
    expect(board[1]).toMatchObject({ stepCount: 1, minutes: 0.5, notes: [], cues: [] });
  });
});

describe("the honesty check", () => {
  const withActivity = (print?: object) => [
    {
      type: "panels",
      chapter: "main",
      id: "poll",
      title: "Ask them",
      panels: [panel(words("question"), { activity: ask, ...(print ? { print } : {}) })],
    },
  ];

  it("fires on a step whose activity would print as an empty result", () => {
    const problems = printProblems(talk(withActivity()));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.where).toBe('slide "poll" step 1');
    expect(printProblemMessage(problems[0] as never)).toContain("would print as it never was");
    expect(printProblemMessage(problems[0] as never)).toContain("print: { hide: true }");
  });

  it("is satisfied by any of the four rules, because each one is a decision", () => {
    for (const rule of [
      { hide: true },
      { keep: true },
      { text: "What the room answered." },
      { replaceWith: words("the answers") },
    ]) {
      expect(printProblems(talk(withActivity(rule)))).toEqual([]);
    }
  });

  it("fires on a live-only block, and names it", () => {
    const problems = printProblems(
      talk([
        {
          type: "panels",
          chapter: "main",
          id: "join",
          title: "Join in",
          panels: [panel({ type: "code", caption: "Scan me" })],
        },
      ]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.what).toContain('"code"');
  });

  it("stays quiet where a slide has already decided what paper shows", () => {
    expect(
      printProblems(
        talk([
          {
            type: "panels",
            chapter: "main",
            id: "join",
            title: "Join in",
            panels: [panel({ type: "code" }, { print: { replaceWith: words("the address") } })],
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("asks once for an activity that runs across a build-up, and takes one answer", () => {
    const build = (print?: object) => [
      {
        type: "panels",
        chapter: "main",
        id: "ask",
        title: "Ask them",
        panels: [
          panel(words("one"), { activity: ask, ...(print ? { print } : {}) }),
          panel(words("two"), { activity: ask }),
          panel(words("three"), { activity: ask }),
        ],
      },
    ];
    const problems = printProblems(talk(build()));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.where).toBe('slide "ask" step 1');
    // One rule anywhere in the run answers for the whole activity.
    expect(printProblems(talk(build({ text: "What they answered." })))).toEqual([]);
  });

  it("says nothing about an ordinary slide", () => {
    expect(
      printProblems(
        talk([
          {
            type: "panels",
            chapter: "main",
            id: "plain",
            title: "Plain",
            panels: [panel(words("one"))],
          },
        ]),
      ),
    ).toEqual([]);
  });
});
