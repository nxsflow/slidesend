import {
  activityMeta,
  createRegistry,
  defineActivity,
  defineBlock,
  definePlugin,
  stepMeta,
} from "@slidesend/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { basics, defaultDesign, defaultTokens, section, sectionPosition } from "./index";

const Nothing = () => null;

const probe = defineActivity({
  type: "probe",
  schema: z.object({ id: z.string(), ...activityMeta }),
  Participant: Nothing,
});

const note = defineBlock({
  type: "note",
  schema: z.object({ text: z.string() }),
  Component: Nothing,
});

/** Builds up item by item; each item may carry its own notes. */
const build = defineBlock({
  type: "build",
  schema: z.object({ items: z.array(z.object({ text: z.string(), ...stepMeta })).min(1) }),
  steps: (data) => data.items.length,
  describe: (data) => ({
    label: "build",
    steps: data.items.map(({ text: _text, ...meta }) => meta),
  }),
  Component: Nothing,
});

/** Asks a poll on its own step. */
const ask = defineBlock({
  type: "ask",
  schema: z.object({ id: z.string() }),
  describe: (data) => ({ label: "ask", steps: [{ activity: probe({ id: data.id }) }] }),
  Component: Nothing,
});

const registry = createRegistry([
  basics(),
  definePlugin({ name: "fixture", blocks: [note, build, ask], activities: [probe] }),
]);

const described = (node: ReturnType<typeof section>) => registry.describe(node).steps;

describe("section steps", () => {
  it("counts one step per panel, and a building block's steps in place", () => {
    const node = section({
      chapter: "c",
      title: "Falling",
      panels: [
        { content: note({ text: "One" }) },
        { content: build({ items: [{ text: "a" }, { text: "b" }, { text: "c" }] }) },
        {},
      ],
    });
    expect(registry.stepsOf(node)).toBe(5);
  });

  it("adds a first step for the hero title", () => {
    const node = section({
      chapter: "c",
      title: "Falling",
      hero: true,
      panels: [{ content: note({ text: "One" }) }],
    });
    expect(registry.stepsOf(node)).toBe(2);
  });

  it("has one step without panels", () => {
    expect(registry.stepsOf(section({ chapter: "c", title: "Alone" }))).toBe(1);
    expect(described(section({ chapter: "c", title: "Alone" }))).toEqual([{}]);
  });
});

describe("section describe", () => {
  it("puts a panel's fields on its first step and keeps what the block describes", () => {
    const node = section({
      chapter: "c",
      title: "Falling",
      panels: [
        { content: note({ text: "One" }), notes: "Say one.", minutes: 1 },
        {
          content: build({ items: [{ text: "a" }, { text: "b", notes: "Now b." }] }),
          notes: "Start building.",
          cue: "Slowly",
        },
        { notes: "Empty panel." },
      ],
    });
    expect(described(node)).toEqual([
      { notes: "Say one.", minutes: 1, activity: undefined },
      { notes: "Start building.", cue: "Slowly", activity: undefined },
      { notes: "Now b.", activity: undefined },
      { notes: "Empty panel.", activity: undefined },
    ]);
    expect(registry.describe(node).label).toBe("Falling");
  });

  it("describes the hero step with the top-level fields and a frame hint", () => {
    const node = section({
      chapter: "c",
      title: "Falling",
      hero: true,
      notes: "Welcome everyone.",
      minutes: 2,
      panels: [{ content: note({ text: "One" }) }],
    });
    const [hero, first] = described(node);
    expect(hero).toEqual({ notes: "Welcome everyone.", minutes: 2, frame: { heroTitle: true } });
    expect(first).toEqual({ activity: undefined });
  });

  it("takes over the activity a block contributes, unless the panel attaches its own", () => {
    const node = section({
      chapter: "c",
      title: "Quiz",
      panels: [
        { content: ask({ id: "mood" }) },
        { content: ask({ id: "other" }), activity: probe({ id: "own" }) },
        {
          content: build({ items: [{ text: "a" }, { text: "b" }] }),
          activity: probe({ id: "kept" }),
        },
      ],
    });
    const ids = described(node).map((step) => (step.activity as { id?: string } | undefined)?.id);
    expect(ids).toEqual(["mood", "own", "kept", "kept"]);
  });
});

describe("section position", () => {
  const data = { title: "t", hero: true, panels: [] } as never;
  it("maps a step to the hero, or to a panel and the step within its block", () => {
    const counts = [1, 3, 1];
    expect(sectionPosition(data, counts, 0)).toEqual({ hero: true });
    expect(sectionPosition(data, counts, 1)).toEqual({ hero: false, panel: 0, inner: 0 });
    expect(sectionPosition(data, counts, 3)).toEqual({ hero: false, panel: 1, inner: 1 });
    expect(sectionPosition(data, counts, 5)).toEqual({ hero: false, panel: 2, inner: 0 });
    expect(sectionPosition({ ...(data as object), hero: false } as never, counts, 0)).toEqual({
      hero: false,
      panel: 0,
      inner: 0,
    });
  });
});

describe("default design", () => {
  it("provides every required token and component", () => {
    expect(defaultDesign.name).toBe("default");
    expect(defaultDesign.tokens).toBe(defaultTokens);
    expect(defaultTokens.base.accents.length).toBeGreaterThanOrEqual(4);
    for (const component of [
      "StageFrame",
      "PhoneFrame",
      "StartPage",
      "ClosedPage",
      "IdlePage",
    ] as const) {
      expect(typeof defaultDesign[component]).toBe("function");
    }
  });
});
