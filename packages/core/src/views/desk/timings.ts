/**
 * What a rehearsal is worth afterwards (spec §12 Review, §13 Timing).
 *
 * A talk is planned in `minutes` per step, guessed before it was ever held. A rehearsal measures
 * what it really takes — except at the steps where the audience answers, because nobody answers
 * to an empty room. So this module keeps three numbers apart and never mixes them: what was
 * PLANNED, what was MEASURED, and what is ESTIMATED for the audience. Only the first two are
 * facts, and the third is entered by hand, which is why it is a field and not a formula.
 *
 * Nothing here adopts anything by itself. The desk offers two exits — adopt as plan, or copy a
 * prompt for an agent — and both are a deliberate act of the person who held the rehearsal.
 */
import type { DeckStep, Presentation } from "../../deck/presentation";
import type { AdoptedPlan, StepTiming } from "../../sessions/runtime-types";

/** How a step is addressed in timings, estimates and an adopted plan. */
export function stepKey(slideId: string, step: number): string {
  return `${slideId}:${step}`;
}

/** One line of the review table: one step of the deck. */
export interface ReviewRow {
  index: number;
  slideId: string;
  step: number;
  key: string;
  /** The slide's label, for the person reading the table. */
  label: string;
  /** What the deck plans for this step, in ms. */
  plannedMs: number;
  /** What the rehearsal measured on the FIRST visit, in ms; 0 when it was never reached. */
  measuredMs: number;
  /** How often the cursor entered this step. */
  visits: number;
  /** Whether the step has an activity, which is what preselects it for an estimate. */
  hasActivity: boolean;
  /** The audience time entered for this step, in ms. Never measured, always estimated. */
  audienceMs: number;
  /** Whether the dwell time stands out enough to look at it again. */
  flagged: boolean;
}

/** Audience-time estimates, in seconds, by `stepKey`. A key with `undefined` is not preselected. */
export type Estimates = Readonly<Record<string, number>>;

/**
 * The measured dwell of every step, from the FIRST visit only.
 *
 * Going back and forward enters a step twice, and the second visit is not a second rehearsal of
 * it: it is the speaker looking something up. Counting both would inflate exactly the steps
 * someone was unsure about — the ones whose numbers matter most.
 */
export function firstVisits(timings: readonly StepTiming[]): Map<string, StepTiming> {
  const byStep = new Map<string, StepTiming>();
  const ordered = [...timings].sort((a, b) => a.at - b.at);
  for (const timing of ordered) {
    const key = stepKey(timing.slideId, timing.step);
    if (!byStep.has(key)) byStep.set(key, timing);
  }
  return byStep;
}

/** How often each step was entered. */
export function visitCounts(timings: readonly StepTiming[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const timing of timings) {
    const key = stepKey(timing.slideId, timing.step);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * A dwell time is flagged when it is both far above what the step plans and far above the
 * rehearsal's own middle. Two conditions, because either alone cries wolf: a step planned at
 * half a minute is beaten by any pause, and a talk of mostly short steps would flag its one
 * long explanation for no reason.
 */
export function flagged(measuredMs: number, plannedMs: number, medianMs: number): boolean {
  if (measuredMs === 0) return false;
  const overPlan = plannedMs > 0 ? measuredMs > plannedMs * 2 : true;
  return overPlan && measuredMs > Math.max(medianMs * 3, 60_000);
}

function median(values: readonly number[]): number {
  const sorted = [...values].filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** The step's planned time in ms; `minutes` is the deck's unit. */
const plannedMsOf = (step: DeckStep) => Math.round((step.minutes ?? 0) * 60_000);

/** The review table: one row per step of the deck, in deck order. */
export function reviewRows(
  presentation: Presentation,
  timings: readonly StepTiming[],
  estimates: Estimates = {},
): ReviewRow[] {
  const visits = firstVisits(timings);
  const counts = visitCounts(timings);
  const middle = median([...visits.values()].map((timing) => timing.ms));
  return presentation.steps.map((step) => {
    const key = stepKey(step.slideId, step.step);
    const measuredMs = visits.get(key)?.ms ?? 0;
    const plannedMs = plannedMsOf(step);
    return {
      index: step.index,
      slideId: step.slideId,
      step: step.step,
      key,
      label: step.label,
      plannedMs,
      measuredMs,
      visits: counts.get(key) ?? 0,
      hasActivity: Boolean(step.activity),
      audienceMs: Math.round((estimates[key] ?? 0) * 1000),
      flagged: flagged(measuredMs, plannedMs, middle),
    };
  });
}

/** Which steps the desk preselects for an audience estimate: the ones with an activity. */
export function preselected(presentation: Presentation): string[] {
  return presentation.steps
    .filter((step) => step.activity)
    .map((step) => stepKey(step.slideId, step.step));
}

/** The sums under the table. */
export interface ReviewTotals {
  plannedMs: number;
  measuredMs: number;
  audienceMs: number;
  /** Measured plus the estimates: what the talk would take with an audience in the room. */
  totalMs: number;
  /** How many steps of the deck the rehearsal actually reached. */
  reached: number;
}

export function reviewTotals(rows: readonly ReviewRow[]): ReviewTotals {
  const sum = (pick: (row: ReviewRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const measuredMs = sum((row) => row.measuredMs);
  const audienceMs = sum((row) => row.audienceMs);
  return {
    plannedMs: sum((row) => row.plannedMs),
    measuredMs,
    audienceMs,
    totalMs: measuredMs + audienceMs,
    reached: rows.filter((row) => row.visits > 0).length,
  };
}

/**
 * An adopted plan carries a hash of the deck's timing. When the deck's timing changes afterwards
 * the plan lapses — quietly following a changed deck would be worse than saying so, because the
 * numbers would then belong to a talk that no longer exists.
 */
export type { AdoptedPlan };

/**
 * A fingerprint of the deck's timing: every step's id and planned minutes, in order. It changes
 * when a step is added, removed, reordered or re-planned — and not when a wording changes.
 */
export function timingHash(presentation: Presentation): string {
  const material = presentation.steps
    .map((step) => `${stepKey(step.slideId, step.step)}=${step.minutes ?? 0}`)
    .join("|");
  // A small, stable, dependency-free hash (FNV-1a): this is a change detector, not a signature.
  let hash = 0x811c9dc5;
  for (let index = 0; index < material.length; index++) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Rounds to a tenth of a minute, the smallest unit a deck's `minutes` carries. */
const toMinutes = (ms: number) => Math.round(ms / 6000) / 10;

/** Builds the plan a rehearsal suggests: measured plus estimated, per step. */
export function adoptPlan(
  presentation: Presentation,
  rows: readonly ReviewRow[],
  sessionId: string,
  now = Date.now(),
): AdoptedPlan {
  const minutes: Record<string, number> = {};
  for (const row of rows) {
    // A step the rehearsal never reached keeps what the deck plans; there is nothing better.
    const ms = row.visits > 0 ? row.measuredMs + row.audienceMs : row.plannedMs;
    minutes[row.key] = toMinutes(ms);
  }
  return { minutes, hash: timingHash(presentation), adoptedAt: now, sessionId };
}

/** Whether an adopted plan still belongs to this deck. */
export function planApplies(plan: AdoptedPlan | undefined, presentation: Presentation): boolean {
  return Boolean(plan) && plan?.hash === timingHash(presentation);
}

/**
 * The minutes that count for a step: the adopted plan where it applies, the deck otherwise. One
 * rule, in one place, so the clock on the Present tab and the review table cannot disagree.
 */
export function effectiveMinutes(
  presentation: Presentation,
  step: DeckStep,
  plan?: AdoptedPlan,
): number {
  if (planApplies(plan, presentation)) {
    const adopted = plan?.minutes[stepKey(step.slideId, step.step)];
    if (typeof adopted === "number") return adopted;
  }
  return step.minutes ?? 0;
}

/**
 * The planned minutes before a step starts, under the same rule — what the clock on the Present
 * tab compares the elapsed time against. `DeckStep.startMinutes` is the deck's own answer; this
 * is the one an adopted plan gives.
 */
export function startMinutesAt(
  presentation: Presentation,
  index: number,
  plan?: AdoptedPlan,
): number {
  if (!planApplies(plan, presentation)) return presentation.steps[index]?.startMinutes ?? 0;
  return presentation.steps
    .slice(0, Math.max(0, index))
    .reduce((total, step) => total + effectiveMinutes(presentation, step, plan), 0);
}

/** The planned length of the whole talk under the same rule. */
export function effectivePlannedMinutes(presentation: Presentation, plan?: AdoptedPlan): number {
  return presentation.steps.reduce(
    (total, step) => total + effectiveMinutes(presentation, step, plan),
    0,
  );
}

/** "7:42", as a stopwatch shows it. */
export function asClock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The prompt for an agent.
 *
 * Short on purpose, and a table rather than prose: it goes into a chat window, where a person
 * should be able to read it once before sending it. It carries what cannot be looked up — the
 * measurement — and asks for exactly two things, so that an agent cannot wander off into
 * rewriting the talk. Cuts are asked for ONLY when the talk is too long; an agent that proposes
 * cuts to a talk that fits is answering a question nobody asked.
 */
export function analysisPrompt(
  presentation: Presentation,
  rows: readonly ReviewRow[],
  targetMinutes: number,
): string {
  const totals = reviewTotals(rows);
  const reached = rows.filter((row) => row.visits > 0);
  const lines = [
    `I rehearsed "${presentation.meta.title}" once and recorded how long every step took.`,
    "",
    `Target length: ${targetMinutes} minutes, including the time the audience needs.`,
    `Measured ${asClock(totals.measuredMs)} over ${totals.reached} of ${rows.length} steps,` +
      ` plus ${asClock(totals.audienceMs)} estimated for the audience` +
      ` = ${asClock(totals.totalMs)}.`,
    "",
    "I rehearsed alone, so at the steps where the audience answers I clicked through and",
    'estimated instead. Those estimates are the "audience" column and are in no measured time.',
    "",
    "| step | slide | planned | measured | audience |",
    "|---|---|---|---|---|",
    // The slide's title is printed once per slide: repeating it on every step of the same slide
    // fills the column with the same words and hides the one thing that differs, the step.
    ...reached.map((row, position) => {
      // Every row names its step, never only its slide: a real run showed that a bare slide id
      // leaves an agent guessing whether the row is a hero title or the slide's first panel.
      // The title comes once per slide, beside the step it belongs to.
      const first = reached[position - 1]?.slideId !== row.slideId;
      const what = `${row.slideId}:${row.step}${first ? ` ${row.label}` : ""}`;
      return (
        `| ${row.index + 1} | ${what} | ${asClock(row.plannedMs)} | ` +
        `${asClock(row.measuredMs)}${row.flagged ? " !" : ""} | ` +
        `${row.hasActivity ? asClock(row.audienceMs) : "—"} |`
      );
    }),
    "",
    "A `!` marks a step where I took much longer than planned.",
    "",
    "Please do two things, and nothing else:",
    "",
    "1. Write these values into the deck as `minutes` on each step" +
      " (measured plus audience, rounded to a tenth of a minute).",
    `2. Only if the total exceeds ${targetMinutes} minutes: propose which steps to cut or shorten,` +
      " with the reason for each.",
  ];
  return lines.join("\n");
}
