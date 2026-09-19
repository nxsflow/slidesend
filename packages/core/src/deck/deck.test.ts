import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  activityMeta,
  activityRef,
  blockSlot,
  type Deck,
  DeckValidationError,
  defineActivity,
  defineBlock,
  defineDeck,
  definePlugin,
  definePresentation,
  defineSlide,
  type Plugin,
  ref,
  type StepDescription,
  stepMeta,
} from "../index";
import { plainDesign } from "../testing";

const Nothing = () => null;
const design = plainDesign;

const poll = defineActivity({
  type: "poll",
  schema: z.object({ id: z.string(), questions: z.array(z.string()).min(1), ...activityMeta }),
  Participant: Nothing,
});

const agentChat = defineActivity({
  type: "agentChat",
  schema: z.object({ id: z.string(), agent: ref("agent"), ...activityMeta }),
  Participant: Nothing,
});

const statement = defineBlock({
  type: "statement",
  schema: z.object({ text: z.string() }),
  Component: Nothing,
});

const reveal = defineBlock({
  type: "reveal",
  schema: z.object({ items: z.array(z.object({ text: z.string(), ...stepMeta })).min(1) }),
  steps: (data) => data.items.length,
  describe: (data) => ({ label: "reveal", steps: data.items.map(({ text, ...meta }) => meta) }),
  Component: Nothing,
});

/** Either asks its own poll (`id` and `questions`) or shows one asked elsewhere (`of`). */
const matrix = defineBlock({
  type: "matrix",
  schema: z.object({
    id: z.string().optional(),
    questions: z.array(z.string()).optional(),
    of: activityRef().optional(),
  }),
  describe: (data) => ({
    label: "matrix",
    steps: [
      data.id && data.questions
        ? { activity: poll({ id: data.id, questions: data.questions }) }
        : {},
    ],
  }),
  Component: Nothing,
});

/** A glossary term; only valid when a plugin provides glossary ids. */
const term = defineBlock({
  type: "term",
  schema: z.object({ word: ref("glossary") }),
  Component: Nothing,
});

/** Panels, each one step or as many as its content takes; a hero title adds a first step. */
const section = defineSlide({
  type: "section",
  schema: z.object({
    title: z.string(),
    hero: z.boolean().default(false),
    panels: z.array(z.object({ content: blockSlot().optional(), ...stepMeta })),
  }),
  steps: (data, { stepsOf }) =>
    (data.hero ? 1 : 0) +
    data.panels.reduce((sum, panel) => sum + (panel.content ? stepsOf(panel.content) : 1), 0),
  describe: (data, { describe }) => ({
    label: data.title,
    steps: [
      ...(data.hero ? [{ frame: { heroTitle: true } }] : []),
      ...data.panels.flatMap(({ content, ...own }): StepDescription[] =>
        content
          ? describe(content).steps.map((nested) => ({
              ...nested,
              ...own,
              activity: own.activity ?? nested.activity,
            }))
          : [own],
      ),
    ],
  }),
  Component: Nothing,
});

const title = defineSlide({
  type: "title",
  schema: z.object({ title: z.string(), ...stepMeta }),
  Component: Nothing,
});

const basics = definePlugin({
  name: "basics",
  slides: [section, title],
  blocks: [statement, reveal, matrix, term],
});
const polls = definePlugin({ name: "polls", activities: [poll] });
const agents = definePlugin({
  name: "agents",
  activities: [agentChat],
  provides: { agent: ["raw"] },
});
const plugins = [basics, polls, agents] as const;

const meta = { title: "How does gravity work?", language: "en" };
const chapters = [
  { id: "intro", title: "Introduction" },
  { id: "quiz", title: "Quiz" },
];

function problems(deck: Deck, installed: readonly Plugin[] = plugins): string[] {
  try {
    definePresentation({ deck, design, plugins: installed });
  } catch (error) {
    if (error instanceof DeckValidationError) return error.message.split("\n").slice(1);
    throw error;
  }
  throw new Error("expected a DeckValidationError");
}

describe("definePresentation", () => {
  const deck = defineDeck({
    meta,
    chapters,
    slides: [
      title({ chapter: "intro", title: "Gravity", minutes: 1.5, notes: "Welcome." }),
      section({
        chapter: "intro",
        title: "Falling",
        hero: true,
        panels: [
          { content: statement({ text: "Everything falls." }), minutes: 2 },
          {
            content: reveal({ items: [{ text: "Apple", minutes: 1 }, { text: "Feather" }] }),
            cue: "Drop both",
          },
        ],
      }),
      section({
        id: "ask",
        chapter: "quiz",
        title: "What do you think?",
        panels: [
          { content: matrix({ id: "mood", questions: ["Heavy falls faster?", "Air matters?"] }) },
          { activity: agentChat({ id: "chat", agent: "raw", keep: { until: "quiz-2" } }) },
        ],
      }),
      section({ chapter: "quiz", title: "Results", panels: [{ content: matrix({ of: "mood" }) }] }),
    ],
  });
  const presentation = definePresentation({ deck, design, plugins });

  it("resolves slide ids: its own, or chapter and position within the chapter", () => {
    expect(presentation.slides.map((slide) => slide.id)).toEqual([
      "intro-1",
      "intro-2",
      "ask",
      "quiz-2",
    ]);
  });

  it("flattens every step, through nested blocks and hero steps, with planned minutes", () => {
    const rows = presentation.steps.map(({ index, slideId, step, minutes, startMinutes, cue }) => ({
      index,
      slideId,
      step,
      minutes,
      startMinutes,
      cue,
    }));
    expect(rows).toEqual([
      { index: 0, slideId: "intro-1", step: 0, minutes: 1.5, startMinutes: 0, cue: undefined },
      {
        index: 1,
        slideId: "intro-2",
        step: 0,
        minutes: undefined,
        startMinutes: 1.5,
        cue: undefined,
      },
      { index: 2, slideId: "intro-2", step: 1, minutes: 2, startMinutes: 1.5, cue: undefined },
      { index: 3, slideId: "intro-2", step: 2, minutes: 1, startMinutes: 3.5, cue: "Drop both" },
      {
        index: 4,
        slideId: "intro-2",
        step: 3,
        minutes: undefined,
        startMinutes: 4.5,
        cue: "Drop both",
      },
      { index: 5, slideId: "ask", step: 0, minutes: undefined, startMinutes: 4.5, cue: undefined },
      { index: 6, slideId: "ask", step: 1, minutes: undefined, startMinutes: 4.5, cue: undefined },
      {
        index: 7,
        slideId: "quiz-2",
        step: 0,
        minutes: undefined,
        startMinutes: 4.5,
        cue: undefined,
      },
    ]);
    expect(presentation.plannedMinutes).toBe(4.5);
    expect(presentation.steps[1]?.frame).toEqual({ heroTitle: true });
  });

  it("keeps the activity a block contributes, and the one a panel attaches", () => {
    expect(presentation.steps[5]?.activity).toMatchObject({ type: "poll", id: "mood" });
    expect(presentation.steps[6]?.activity).toMatchObject({ type: "agentChat", agent: "raw" });
  });

  it("records where each slide's steps start", () => {
    expect(presentation.slides.map(({ firstStep, stepCount }) => [firstStep, stepCount])).toEqual([
      [0, 1],
      [1, 4],
      [5, 2],
      [7, 1],
    ]);
  });

  it("returns the validated meta and the configuration", () => {
    expect(presentation.meta.title).toBe("How does gravity work?");
    expect(presentation.design).toBe(design);
    expect(presentation.platform).toBeUndefined();
    expect(presentation.messages).toEqual({});
  });
});

describe("validation", () => {
  const ok = title({ chapter: "intro", title: "Gravity" });

  it("checks the meta data", () => {
    expect(problems({ meta: { title: "" } as never, chapters, slides: [ok] })).toEqual([
      "  meta title: Too small: expected string to have >=1 characters",
      "  meta language: Invalid input: expected string, received undefined",
    ]);
  });

  it("rejects duplicate chapter ids", () => {
    expect(
      problems({ meta, chapters: [...chapters, { id: "intro", title: "Again" }], slides: [ok] }),
    ).toEqual(['  chapters[2] id: Duplicate chapter id "intro".']);
  });

  it("rejects a slide in a chapter that does not exist", () => {
    expect(
      problems({ meta, chapters, slides: [title({ chapter: "outro", title: "Bye" })] }),
    ).toEqual(['  slide "outro-1" (slides[0]) chapter: No chapter has the id "outro".']);
  });

  it("rejects duplicate slide ids, own and derived", () => {
    const slides = [ok, title({ id: "intro-1", chapter: "quiz", title: "Clash" })];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "intro-1" (slides[1]) id: Duplicate slide id "intro-1"; slides[0] has it too.',
    ]);
  });

  it("names the slide id and the field path of a schema error", () => {
    const slides = [
      ok,
      section({
        chapter: "intro",
        title: "Falling",
        panels: [{ content: statement({} as never) }],
      }),
    ];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "intro-2" (slides[1]) panels[0].content.text: Invalid input: expected string, received undefined',
    ]);
  });

  it("rejects node types that no installed plugin provides", () => {
    const slides = [
      { type: "fullBleed", chapter: "intro" },
      section({
        chapter: "intro",
        title: "Falling",
        panels: [{ content: statement({ text: "Hi" }) }],
      }),
    ];
    expect(problems({ meta, chapters, slides: slides as never }, [basics])).toEqual([
      '  slide "intro-1" (slides[0]) type: No installed plugin provides the slide type "fullBleed".',
    ]);
    const asking = section({
      chapter: "intro",
      title: "Ask",
      panels: [{ activity: poll({ id: "p", questions: ["?"] }) }],
    });
    expect(problems({ meta, chapters, slides: [asking] }, [basics])).toEqual([
      '  slide "intro-1" (slides[0]) panels[0].activity.type: No installed plugin provides the activity type "poll".',
    ]);
  });

  it("rejects an activity id declared twice", () => {
    const slides = [
      section({
        chapter: "intro",
        title: "A",
        panels: [{ content: matrix({ id: "mood", questions: ["a", "b"] }) }],
      }),
      section({
        chapter: "intro",
        title: "B",
        panels: [{ activity: poll({ id: "mood", questions: ["?"] }) }],
      }),
    ];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "intro-2" (slides[1]): Duplicate activity id "mood"; slide "intro-1" (slides[0]) declares it too.',
    ]);
  });

  it("resolves every reference: of, keep.until and agent", () => {
    const slides = [
      section({
        chapter: "intro",
        title: "Refs",
        panels: [
          { content: matrix({ of: "nothing" }) },
          { activity: poll({ id: "p", questions: ["?"], keep: { until: "nowhere" } }) },
          { activity: agentChat({ id: "c", agent: "sage" }) },
        ],
      }),
    ];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "intro-1" (slides[0]) panels[0].content.of: No activity has the id "nothing".',
      '  slide "intro-1" (slides[0]) panels[1].activity.keep.until: No slide has the id "nowhere".',
      '  slide "intro-1" (slides[0]) panels[2].activity.agent: No installed plugin provides the agent "sage".',
    ]);
  });

  it("rejects a reference kind that no installed plugin provides", () => {
    const slides = [
      section({ chapter: "intro", title: "Words", panels: [{ content: term({ word: "mass" }) }] }),
    ];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "intro-1" (slides[0]) panels[0].content.word: No installed plugin provides references of the kind "glossary".',
    ]);
  });

  it("reports every problem at once, and counts derived ids by position", () => {
    const slides = [
      title({ chapter: "outro", title: "Bye" }),
      ok,
      ok,
      title({ id: "intro-2", chapter: "quiz", title: 42 as never }),
    ];
    expect(problems({ meta, chapters, slides })).toEqual([
      '  slide "outro-1" (slides[0]) chapter: No chapter has the id "outro".',
      '  slide "intro-2" (slides[3]) id: Duplicate slide id "intro-2"; slides[2] has it too.',
      '  slide "intro-2" (slides[3]) title: Invalid input: expected string, received number',
    ]);
  });
});

describe("types", () => {
  it("reject a slide from a plugin that is not installed", () => {
    const deck = defineDeck({ meta, chapters, slides: [title({ chapter: "intro", title: "Hi" })] });
    const onlyPolls = [polls] as const;
    const check = () =>
      // @ts-expect-error: "title" comes from basics, which is not installed
      definePresentation({ deck, design, plugins: onlyPolls });
    expect(check).toThrow(DeckValidationError);
    expect(() => definePresentation({ deck, design, plugins })).not.toThrow();
  });
});
