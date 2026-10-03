import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  type ActivityNode,
  activityMeta,
  activitySlot,
  blockSlot,
  createRegistry,
  defineActivity,
  defineBlock,
  definePlugin,
  defineSlide,
  NodeValidationError,
  type SlideNode,
  type StepDescription,
  stepMeta,
} from "../index";

const Nothing = () => null;

const poll = defineActivity({
  type: "poll",
  schema: z.object({ id: z.string(), questions: z.array(z.string()).min(1), ...activityMeta }),
  Participant: Nothing,
});

const statement = defineBlock({
  type: "statement",
  schema: z.object({ text: z.string() }),
  Component: Nothing,
});

/** A block that builds up item by item, one step per item. */
const reveal = defineBlock({
  type: "reveal",
  schema: z.object({ items: z.array(z.object({ text: z.string(), ...stepMeta })).min(1) }),
  steps: (data) => data.items.length,
  describe: (data) => ({
    label: data.items[0]?.text ?? "reveal",
    steps: data.items.map(({ notes, cue }) => ({ notes, cue })),
  }),
  Component: Nothing,
});

/** A block coupled to the phones: it asks its questions through a poll on its own step. */
const matrix = defineBlock({
  type: "matrix",
  schema: z.object({ id: z.string(), questions: z.array(z.string()).length(2) }),
  describe: (data) => ({
    label: "matrix",
    steps: [{ activity: poll({ id: data.id, questions: data.questions }) }],
  }),
  Component: Nothing,
});

/** A slide made of panels; each panel is one step, or as many as its content takes. */
const section = defineSlide({
  type: "section",
  schema: z.object({
    title: z.string(),
    hero: z.boolean().default(false),
    panels: z.array(z.object({ content: blockSlot().optional(), ...stepMeta })),
  }),
  steps: (data, { stepsOf }) =>
    data.panels.reduce((sum, panel) => sum + (panel.content ? stepsOf(panel.content) : 1), 0),
  describe: (data, { describe }) => ({
    label: data.title,
    steps: data.panels.flatMap(({ content, ...own }): StepDescription[] => {
      if (!content) return [own];
      return describe(content).steps.map((nested) => ({
        ...nested,
        ...own,
        activity: own.activity ?? nested.activity,
      }));
    }),
  }),
  Component: Nothing,
});

const title = defineSlide({
  type: "title",
  schema: z.object({ title: z.string(), ...stepMeta }),
  Component: Nothing,
});

const plugins = [
  definePlugin({ name: "test", slides: [section, title], blocks: [statement, reveal, matrix] }),
  definePlugin({ name: "poll", activities: [poll] }),
];

function issuesOf(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof NodeValidationError) return error.message.split("\n").slice(1);
    throw error;
  }
  throw new Error("expected a NodeValidationError");
}

describe("builders", () => {
  it("return the node as { type, ...data }", () => {
    expect(statement({ text: "Gravity pulls." })).toEqual({
      type: "statement",
      text: "Gravity pulls.",
    });
    expect(
      section({
        chapter: "intro",
        title: "Why do things fall?",
        panels: [{ notes: "Ask first." }],
      }),
    ).toEqual({
      type: "section",
      chapter: "intro",
      title: "Why do things fall?",
      panels: [{ notes: "Ask first." }],
    });
  });

  it("carry the definition, so a plugin can list it", () => {
    expect(section.type).toBe("section");
    expect(section.group).toBe("slide");
    expect(poll.group).toBe("activity");
    expect(statement.Component).toBe(Nothing);
  });
});

describe("parse", () => {
  const registry = createRegistry(plugins);

  it("applies defaults and validates nested blocks", () => {
    const node = registry.parse(
      "slide",
      section({
        chapter: "intro",
        title: "Falling",
        panels: [{ content: statement({ text: "Hi" }) }],
      }),
    );
    expect(node).toEqual({
      type: "section",
      chapter: "intro",
      title: "Falling",
      hero: false,
      panels: [{ content: { type: "statement", text: "Hi" } }],
    });
  });

  it("reports every problem with a readable path", () => {
    const issues = issuesOf(() =>
      registry.parse("slide", {
        type: "section",
        title: 42,
        panels: [
          { content: { type: "statement" } },
          { content: { type: "nope" } },
          { content: { type: "poll", id: "x", questions: ["?"] } },
          { activity: { type: "poll", id: "mood", questions: [] } },
        ],
      }),
    );
    expect(issues).toEqual([
      "  chapter: Invalid input: expected string, received undefined",
      "  title: Invalid input: expected string, received number",
      "  panels[0].content.text: Invalid input: expected string, received undefined",
      '  panels[1].content.type: No installed plugin provides the block type "nope".',
      '  panels[2].content.type: "poll" is an activity, not a block.',
      "  panels[3].activity.questions: Too small: expected array to have >=1 items",
    ]);
  });

  it("rejects a node of the wrong group at the top level", () => {
    expect(issuesOf(() => registry.parse("slide", statement({ text: "Hi" })))).toEqual([
      '  type: "statement" is a block, not a slide.',
    ]);
  });

  it("returns the issues instead of throwing from safeParse", () => {
    const result = registry.safeParse("block", { type: "statement" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((issue) => issue.path)).toEqual([["text"]]);
  });

  it("refuses to validate a slot outside a registry", () => {
    const schema = z.object({ content: blockSlot() });
    expect(schema.safeParse({ content: statement({ text: "Hi" }) }).success).toBe(false);
  });
});

describe("steps", () => {
  const registry = createRegistry(plugins);

  it("count one step for a node without steps", () => {
    expect(registry.stepsOf(statement({ text: "Hi" }))).toBe(1);
  });

  it("count through nested blocks", () => {
    const node = section({
      chapter: "intro",
      title: "Falling",
      panels: [
        { content: statement({ text: "One" }) },
        { content: reveal({ items: [{ text: "a" }, { text: "b" }, { text: "c" }] }) },
        {},
      ],
    });
    expect(registry.stepsOf(node)).toBe(5);
  });

  it("reject a step count below one", () => {
    const empty = defineBlock({
      type: "empty",
      schema: z.object({}),
      steps: () => 0,
      describe: () => ({ label: "empty", steps: [] }),
      Component: Nothing,
    });
    const own = createRegistry([definePlugin({ name: "own", blocks: [empty] })]);
    expect(() => own.stepsOf(empty({}))).toThrow(/steps of "empty" returned 0/);
  });
});

describe("describe", () => {
  const registry = createRegistry(plugins);

  it("defaults to the title and the top-level step fields for a single-step node", () => {
    expect(
      registry.describe(title({ chapter: "intro", title: "Gravity", notes: "Welcome." })),
    ).toEqual({
      label: "Gravity",
      steps: [{ notes: "Welcome." }],
    });
    expect(registry.describe(statement({ text: "Hi" }))).toEqual({
      label: "statement",
      steps: [{}],
    });
  });

  it("uses a custom describe, one entry per step", () => {
    const node = section({
      chapter: "intro",
      title: "Falling",
      panels: [
        { notes: "Open." },
        {
          content: reveal({
            items: [
              { text: "a", notes: "First." },
              { text: "b", cue: "Pause" },
            ],
          }),
        },
      ],
    });
    expect(registry.describe(node)).toEqual({
      label: "Falling",
      steps: [
        { notes: "Open." },
        { notes: "First.", cue: undefined, activity: undefined },
        { notes: undefined, cue: "Pause", activity: undefined },
      ],
    });
  });

  it("takes over the activity a block contributes to its step", () => {
    const node = section({
      chapter: "quiz",
      title: "What do you think?",
      panels: [
        { content: matrix({ id: "mood", questions: ["Heavy falls faster?", "Air matters?"] }) },
      ],
    });
    const [step] = registry.describe(node).steps;
    expect(step?.activity).toEqual({
      type: "poll",
      id: "mood",
      questions: ["Heavy falls faster?", "Air matters?"],
    });
  });

  it("rejects a describe whose step count does not match", () => {
    const liar = defineBlock({
      type: "liar",
      schema: z.object({}),
      steps: () => 2,
      describe: () => ({ label: "liar", steps: [{}] }),
      Component: Nothing,
    });
    const own = createRegistry([definePlugin({ name: "own", blocks: [liar] })]);
    expect(() => own.describe(liar({}))).toThrow(/returned 1 steps, but the node has 2/);
  });
});

describe("plugins", () => {
  it("reject a node type provided by two plugins, across groups", () => {
    const other = defineActivity({ type: "statement", schema: z.object({}), Participant: Nothing });
    expect(() =>
      createRegistry([...plugins, definePlugin({ name: "other", activities: [other] })]),
    ).toThrow('The node type "statement" is provided by both plugin "test" and plugin "other".');
  });

  it("reject two plugins with the same name", () => {
    expect(() => createRegistry([plugins[1], plugins[1]].filter((p) => p !== undefined))).toThrow(
      'Two installed plugins are named "poll".',
    );
  });

  it("reject a definition listed under the wrong group", () => {
    expect(() => definePlugin({ name: "mixed", slides: [statement as never] })).toThrow(
      'Plugin "mixed" lists the block "statement" under slides.',
    );
  });

  it("reject steps without describe", () => {
    const counted = defineBlock({
      type: "counted",
      schema: z.object({}),
      steps: () => 2,
      Component: Nothing,
    });
    expect(() => createRegistry([definePlugin({ name: "own", blocks: [counted] })])).toThrow(
      'The block "counted" of plugin "own" defines steps but no describe.',
    );
  });
});

describe("types", () => {
  it("type the builder output", () => {
    expectTypeOf(section({ chapter: "c", title: "t", panels: [] })).toExtend<
      SlideNode<"section">
    >();
    expectTypeOf(poll({ id: "p", questions: ["?"] })).toExtend<ActivityNode<"poll">>();
  });

  it("make a wrong field in a builder call a compile error", () => {
    // @ts-expect-error: unknown field
    statement({ text: "Hi", colour: "red" });
    // @ts-expect-error: missing required field
    statement({});
    // @ts-expect-error: wrong field type
    statement({ text: 42 });
    // @ts-expect-error: a slide needs its chapter
    section({ title: "t", panels: [] });
    const slide = title({ chapter: "c", title: "t" });
    const activity = poll({ id: "p", questions: ["?"] });
    const block = statement({ text: "Hi" });
    // @ts-expect-error: a slide does not fit a block slot
    section({ chapter: "c", title: "t", panels: [{ content: slide }] });
    // @ts-expect-error: an activity does not fit a block slot
    section({ chapter: "c", title: "t", panels: [{ content: activity }] });
    // @ts-expect-error: a block is not an activity
    section({ chapter: "c", title: "t", panels: [{ activity: block }] });
    // @ts-expect-error: keep takes true or { until }
    poll({ id: "p", questions: ["?"], keep: false });
    expect(activitySlot).toBeTypeOf("function");
  });
});
