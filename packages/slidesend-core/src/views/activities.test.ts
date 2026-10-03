import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  activityMeta,
  defineActivity,
  defineDeck,
  definePlugin,
  definePresentation,
  defineSlide,
  phonePage,
  type Session,
  stepMeta,
  visibleActivities,
} from "../index";
import { plainDesign } from "../testing";

const Nothing = () => null;
const ask = defineActivity({
  type: "ask",
  schema: z.object({ id: z.string(), ...activityMeta }),
  Participant: Nothing,
});
const slide = defineSlide({
  type: "steps",
  schema: z.object({ title: z.string(), panels: z.array(z.object({ ...stepMeta })).min(1) }),
  steps: (data) => data.panels.length,
  describe: (data) => ({ label: data.title, steps: data.panels }),
  Component: Nothing,
});

// Slide "a" (steps 0-1) asks two activities; "b" (2) and "c" (3) ask none.
const presentation = definePresentation({
  deck: defineDeck({
    meta: { title: "Gravity", language: "en" },
    chapters: [{ id: "c", title: "C" }],
    slides: [
      slide({
        id: "a",
        chapter: "c",
        title: "A",
        panels: [
          { activity: ask({ id: "guess", keep: { until: "c" } }) },
          { activity: ask({ id: "always", keep: true }) },
        ],
      }),
      slide({ id: "b", chapter: "c", title: "B", panels: [{}] }),
      slide({ id: "c", chapter: "c", title: "C", panels: [{ activity: ask({ id: "last" }) }] }),
    ],
  }),
  design: plainDesign,
  plugins: [definePlugin({ name: "test", slides: [slide], activities: [ask] })],
});

const shown = (step: number) =>
  visibleActivities(presentation, step).map(({ activity, current }) => [
    (activity as unknown as { id: string }).id,
    current ? "current" : "kept",
  ]);

describe("which activities a phone shows", () => {
  it("shows the current step's activity first", () => {
    expect(shown(0)).toEqual([["guess", "current"]]);
    expect(shown(1)).toEqual([
      ["always", "current"],
      ["guess", "kept"],
    ]);
  });

  it("keeps an activity while its slide has not been reached", () => {
    expect(shown(2)).toEqual([
      ["guess", "kept"],
      ["always", "kept"],
    ]);
  });

  it("drops a kept activity once its slide is shown, and keeps `keep: true` for good", () => {
    expect(shown(3)).toEqual([
      ["last", "current"],
      ["always", "kept"],
    ]);
  });

  it("never lists the same activity twice", () => {
    const ids = shown(1).map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shows nothing outside the deck", () => {
    expect(visibleActivities(presentation, 99)).toEqual([]);
  });
});

describe("which page a phone shows", () => {
  const session = (overrides: Partial<Session>): Session =>
    ({
      id: "s",
      name: "n",
      kind: "live",
      plannedMinutes: 30,
      leadMinutes: 10,
      graceMinutes: 15,
      extendedMinutes: 0,
      closedPageMinutes: 15,
      state: "draft",
      createdAt: 0,
      ...overrides,
    }) as Session;

  it("follows the session's state and the closed page's time", () => {
    const now = 10_000_000;
    expect(phonePage(undefined, now)).toBe("idle");
    expect(phonePage(session({ state: "draft" }), now)).toBe("idle");
    expect(phonePage(session({ state: "armed" }), now)).toBe("idle");
    expect(phonePage(session({ state: "open" }), now)).toBe("open");
    expect(phonePage(session({ state: "closed", closedAt: now - 60_000 }), now)).toBe("closed");
    expect(phonePage(session({ state: "closed", closedAt: now - 16 * 60_000 }), now)).toBe("idle");
  });
});
