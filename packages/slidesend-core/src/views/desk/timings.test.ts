/**
 * The four rules that decide whether a rehearsal's numbers can be trusted: what counts as the
 * measurement, what going back does to it, which plan wins, and when a plan stops being valid.
 */
import { describe, expect, it } from "vitest";
import type { DeckStep, Presentation } from "../../deck/presentation";
import type { StepTiming } from "../../sessions/runtime-types";
import {
  adoptPlan,
  analysisPrompt,
  asClock,
  effectiveMinutes,
  effectivePlannedMinutes,
  firstVisits,
  flagged,
  planApplies,
  preselected,
  reviewRows,
  reviewTotals,
  startMinutesAt,
  timingHash,
} from "./timings";

/** A deck of four steps, two of which ask the audience something. */
function deck(minutes = [1, 2, 1, 3]): Presentation {
  const steps = minutes.map((value, index) => ({
    index,
    slideId: index < 2 ? "intro" : "outro",
    slideIndex: index < 2 ? 0 : 1,
    step: index % 2,
    chapter: "main",
    label: `step ${index + 1}`,
    startMinutes: minutes.slice(0, index).reduce((a, b) => a + b, 0),
    minutes: value,
    ...(index === 1 || index === 3 ? { activity: { type: "poll", id: `q${index}` } } : {}),
  }));
  return {
    meta: { title: "Falling together", language: "en" },
    steps,
    slides: [],
    plannedMinutes: minutes.reduce((a, b) => a + b, 0),
  } as unknown as Presentation;
}

const timing = (slideId: string, step: number, ms: number, at: number): StepTiming => ({
  index: 0,
  slideId,
  step,
  ms,
  at,
});

describe("what the rehearsal measured", () => {
  it("counts the first visit of a step and ignores the later ones", () => {
    const timings = [
      timing("intro", 0, 60_000, 1_000),
      timing("intro", 1, 30_000, 2_000),
      // Back to the first step and forward again: the same step, a second time.
      timing("intro", 0, 5_000, 3_000),
      timing("intro", 1, 4_000, 4_000),
    ];
    const first = firstVisits(timings);
    expect(first.get("intro:0")?.ms).toBe(60_000);
    const rows = reviewRows(deck(), timings);
    expect(rows[0]).toMatchObject({ measuredMs: 60_000, visits: 2 });
    expect(rows[1]).toMatchObject({ measuredMs: 30_000, visits: 2 });
    // Two visits, one measurement each: going back does not double the talk.
    expect(reviewTotals(rows).measuredMs).toBe(90_000);
  });

  it("reads the timings in the order they happened, whatever order they arrive in", () => {
    const shuffled = [timing("intro", 0, 5_000, 9_000), timing("intro", 0, 60_000, 1_000)];
    expect(firstVisits(shuffled).get("intro:0")?.ms).toBe(60_000);
  });

  it("leaves a step the rehearsal never reached at zero", () => {
    const rows = reviewRows(deck(), [timing("intro", 0, 60_000, 1_000)]);
    expect(rows[3]).toMatchObject({ measuredMs: 0, visits: 0 });
    expect(reviewTotals(rows).reached).toBe(1);
  });

  it("preselects the steps with an activity for an estimate, and only those", () => {
    expect(preselected(deck())).toEqual(["intro:1", "outro:1"]);
    const rows = reviewRows(deck(), [], { "outro:1": 120 });
    expect(rows[3]).toMatchObject({ hasActivity: true, audienceMs: 120_000 });
    expect(reviewTotals(rows).audienceMs).toBe(120_000);
  });

  it("flags a dwell only when it beats both the plan and the rehearsal's own middle", () => {
    // 2x the plan but ordinary for this talk: not worth a flag.
    expect(flagged(120_000, 60_000, 90_000)).toBe(false);
    expect(flagged(400_000, 60_000, 90_000)).toBe(true);
    // Long, but exactly what was planned for it.
    expect(flagged(400_000, 400_000, 30_000)).toBe(false);
    expect(flagged(0, 60_000, 10_000)).toBe(false);
  });
});

describe("the plan a rehearsal suggests", () => {
  const timings = [
    timing("intro", 0, 90_000, 1_000),
    timing("intro", 1, 30_000, 2_000),
    timing("outro", 0, 60_000, 3_000),
  ];

  it("writes measured plus estimated per step, and keeps the deck where nothing was measured", () => {
    const rows = reviewRows(deck(), timings, { "intro:1": 90 });
    const plan = adoptPlan(deck(), rows, "s1", 1_700_000_000_000);
    expect(plan.minutes).toEqual({
      "intro:0": 1.5,
      // 30 s measured plus 90 s estimated for the audience.
      "intro:1": 2,
      "outro:0": 1,
      // Never reached: the deck's own 3 minutes stand.
      "outro:1": 3,
    });
    expect(plan.sessionId).toBe("s1");
  });

  it("wins over the deck's minutes while it applies", () => {
    const presentation = deck();
    const first = presentation.steps[0] as DeckStep;
    const plan = adoptPlan(presentation, reviewRows(presentation, timings), "s1");
    expect(effectiveMinutes(presentation, first, plan)).toBe(1.5);
    expect(effectiveMinutes(presentation, first)).toBe(1);
    expect(effectivePlannedMinutes(presentation, plan)).toBe(6);
    expect(effectivePlannedMinutes(presentation)).toBe(7);
  });

  it("moves the clock's mark with it: what is planned before a step starts", () => {
    const presentation = deck();
    const plan = adoptPlan(presentation, reviewRows(presentation, timings), "s1");
    // The deck plans 1 + 2 = 3 minutes before the third step; the rehearsal took 1.5 + 0.5.
    expect(presentation.steps[2]?.startMinutes).toBe(3);
    expect(startMinutesAt(presentation, 2, plan)).toBe(2);
    expect(startMinutesAt(presentation, 2)).toBe(3);
    // A lapsed plan gives the deck's mark back.
    expect(startMinutesAt(deck([1, 2, 1, 5]), 2, plan)).toBe(3);
  });

  it("lapses when the deck's timing changes, and the deck takes over again", () => {
    const presentation = deck();
    const plan = adoptPlan(presentation, reviewRows(presentation, timings), "s1");
    const replanned = deck([1, 2, 1, 5]);
    expect(planApplies(plan, presentation)).toBe(true);
    expect(planApplies(plan, replanned)).toBe(false);
    // Lapsed means the deck decides again — not that the step loses its time.
    expect(effectiveMinutes(replanned, replanned.steps[0] as DeckStep, plan)).toBe(1);
    expect(effectivePlannedMinutes(replanned, plan)).toBe(9);
  });

  it("changes the hash for a re-plan, a new step and a reorder, but not for a new wording", () => {
    const base = timingHash(deck());
    expect(timingHash(deck([1, 2, 1, 3]))).toBe(base);
    expect(timingHash(deck([1, 2, 1, 4]))).not.toBe(base);
    expect(timingHash(deck([1, 2, 1, 3, 1]))).not.toBe(base);
    expect(timingHash(deck([2, 1, 1, 3]))).not.toBe(base);
    const reworded = deck();
    (reworded.steps[0] as DeckStep).notes = "Say it differently";
    expect(timingHash(reworded)).toBe(base);
  });
});

describe("the prompt for an agent", () => {
  const presentation = deck();
  const rows = reviewRows(
    presentation,
    [
      timing("intro", 0, 90_000, 1_000),
      timing("intro", 1, 20_000, 2_000),
      timing("outro", 0, 600_000, 3_000),
      timing("outro", 1, 40_000, 4_000),
    ],
    { "intro:1": 90, "outro:1": 60 },
  );

  it("stays short enough to be read before it is sent", () => {
    expect(analysisPrompt(presentation, rows, 10).split("\n").length).toBeLessThan(60);
  });

  it("names every row's step, and a slide's title once", () => {
    const prompt = analysisPrompt(presentation, rows, 10);
    expect(prompt).toContain("| 1 | intro:0 step 1 |");
    expect(prompt).toContain("| 2 | intro:1 |");
    expect(prompt).toContain("| 3 | outro:0 step 3 |");
  });

  it("carries the measurement, the target and exactly two instructions", () => {
    const prompt = analysisPrompt(presentation, rows, 10);
    expect(prompt).toContain("Target length: 10 minutes");
    expect(prompt).toContain("| step | slide | planned | measured | audience |");
    // The flagged step is marked in the table, so the agent sees what stood out.
    expect(prompt).toContain("10:00 !");
    expect(prompt).toContain("1. Write these values into the deck as `minutes`");
    expect(prompt).toContain("2. Only if the total exceeds 10 minutes");
    expect(prompt).not.toMatch(/^3\./m);
  });

  it("lists only the steps the rehearsal reached", () => {
    const short = reviewRows(presentation, [timing("intro", 0, 90_000, 1_000)]);
    const prompt = analysisPrompt(presentation, short, 10);
    expect(prompt).toContain("| 1 | intro:0 step 1 |");
    expect(prompt).not.toContain("| 4 |");
    expect(prompt).toContain("Measured 1:30 over 1 of 4 steps");
  });

  it("shows times the way a stopwatch does", () => {
    expect(asClock(90_000)).toBe("1:30");
    expect(asClock(3_000)).toBe("0:03");
    expect(asClock(-5)).toBe("0:00");
  });
});
