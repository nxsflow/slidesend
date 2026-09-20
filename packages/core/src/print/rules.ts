/**
 * What goes on paper (spec §6.3, §4).
 *
 * A printed talk is not a screenshot of a talk. A slide that builds up over five clicks is one
 * page, not five; a QR code is a promise that only works in the room; and a poll prints as the
 * question, never as an empty result. So print is a SELECTION with four rules, and the rules are
 * the author's, not a heuristic's:
 *
 * - `hide`       — leave this step out.
 * - `keep`       — print this intermediate step as well as the final one.
 * - `replaceWith`— print this block instead of the step's own content.
 * - `text`       — print this instead of the step's notes.
 *
 * Everything here reads `describe` only (spec §6.3), so it works for a template this package has
 * never heard of.
 */
import type { DeckStep, Presentation, ResolvedSlide } from "../deck/presentation";
import type { BlockNode } from "../nodes/types";

/** One page of the printed talk. */
export interface PrintStep {
  /** The step's index in the whole deck. */
  index: number;
  step: DeckStep;
  slide: ResolvedSlide;
  /** Whether this is the slide's last printed step, which is the one that carries the title. */
  last: boolean;
  /** A block printed instead of the step's own content. */
  replaceWith?: BlockNode;
  /** What is printed under the step: `print.text` when there is one, else the notes. */
  text?: string;
}

const ruleOf = (step: DeckStep) => step.print ?? {};

/**
 * The steps of one slide that go on paper: its last visible step, plus every step whose author
 * said something about printing it.
 *
 * "The last one" rather than "the one with the most content": a build-up ends in its complete
 * state, and that is the state a reader should see. A slide whose every step is hidden prints
 * nothing at all — which is what `hide` on all of them asks for.
 *
 * `keep`, `replaceWith` and `text` all make a step print. Anything else would let a rule be
 * written and then silently dropped: an author who says what a step shows on paper has said
 * that it IS on paper — and the honesty check would otherwise accept an answer nobody ever
 * reads.
 */
export function printedStepsOfSlide(presentation: Presentation, slide: ResolvedSlide): DeckStep[] {
  const steps = presentation.steps.slice(slide.firstStep, slide.firstStep + slide.stepCount);
  const visible = steps.filter((step) => !ruleOf(step).hide);
  const last = visible.at(-1);
  return visible.filter((step) => {
    const rule = ruleOf(step);
    return step === last || rule.keep || rule.replaceWith || rule.text !== undefined;
  });
}

/** Every page of the printed talk, in deck order. */
export function printSteps(presentation: Presentation): PrintStep[] {
  return presentation.slides.flatMap((slide) => {
    const steps = printedStepsOfSlide(presentation, slide);
    return steps.map((step, position) => {
      const rule = ruleOf(step);
      const text = rule.text ?? step.notes;
      return {
        index: step.index,
        step,
        slide,
        last: position === steps.length - 1,
        ...(rule.replaceWith ? { replaceWith: rule.replaceWith } : {}),
        ...(text ? { text } : {}),
      };
    });
  });
}

/** One page of the storyboard: a slide, what it shows, and what the speaker says to it. */
export interface StoryboardEntry {
  slide: ResolvedSlide;
  /** The step that stands for the slide on paper: its last printed one. */
  step?: DeckStep;
  /** How many steps the slide has, so a build-up is visible as such. */
  stepCount: number;
  /** The planned minutes of the whole slide. */
  minutes: number;
  /** Everything the speaker notes across the slide's steps, in order. */
  notes: string[];
  /** The cues across the slide's steps. */
  cues: string[];
}

/**
 * The storyboard: one entry per slide, with its notes — the whole talk on one page, for reading
 * it through rather than presenting it.
 */
export function storyboard(presentation: Presentation): StoryboardEntry[] {
  return presentation.slides.map((slide) => {
    const steps = presentation.steps.slice(slide.firstStep, slide.firstStep + slide.stepCount);
    const printed = printedStepsOfSlide(presentation, slide);
    return {
      slide,
      ...(printed.at(-1) ? { step: printed.at(-1) } : {}),
      stepCount: slide.stepCount,
      minutes: steps.reduce((total, step) => total + (step.minutes ?? 0), 0),
      notes: steps
        .map((step) => step.print?.text ?? step.notes)
        .filter((note): note is string => Boolean(note)),
      cues: steps.map((step) => step.cue).filter((cue): cue is string => Boolean(cue)),
    };
  });
}

/** A step or slide that would print something the room made true, without saying what to print. */
export interface PrintProblem {
  /** Where it is, as a reader of `slidesend check` finds it. */
  where: string;
  /** What is live-only about it. */
  what: string;
}

/** Walks a slide's data for the block types it contains; templates keep their own shape. */
function blockTypesOf(node: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const entry of node) blockTypesOf(entry, found);
    return found;
  }
  if (node && typeof node === "object") {
    const type = (node as { type?: unknown }).type;
    if (typeof type === "string") found.add(type);
    for (const value of Object.values(node)) blockTypesOf(value, found);
  }
  return found;
}

/**
 * The honesty check (spec §4): a step that only worked because there was a room must say what to
 * print instead, or say that it prints nothing.
 *
 * Two sources of "only in the room": an activity on the step — a poll prints as an empty result
 * unless the author replaces it — and a block whose definition declares `liveOnly`, such as a QR
 * code that points at a session that is over. Any of the four rules counts as an answer, because
 * each one is a decision; the check asks for a decision, not for a particular one.
 *
 * A block is found per SLIDE, not per step: `describe` tells core what a step is, never which
 * blocks a template put in it (spec §6.3). So a slide that carries a live-only block anywhere is
 * answered by a print rule anywhere in it.
 */
export function printProblems(presentation: Presentation): PrintProblem[] {
  const problems: PrintProblem[] = [];
  for (const slide of presentation.slides) {
    const steps = presentation.steps.slice(slide.firstStep, slide.firstStep + slide.stepCount);
    // An activity is ONE thing the author wrote down once, even when it runs across a build-up
    // of several steps. So it is answered once: a print rule on any of its steps settles it, and
    // it is reported once, at the step where it starts. Three identical lines would only bury
    // the other problems.
    const activities = new Map<string, { step: DeckStep; answered: boolean }>();
    for (const step of steps) {
      if (!step.activity) continue;
      const id = String((step.activity as { id?: unknown }).id ?? step.activity.type);
      const seen = activities.get(id);
      if (seen) seen.answered ||= Boolean(step.print);
      else activities.set(id, { step, answered: Boolean(step.print) });
    }
    for (const [id, { step, answered }] of activities) {
      if (answered) continue;
      problems.push({
        where: `slide "${slide.id}" step ${step.step + 1}`,
        what: `the activity "${id}"`,
      });
    }
    const liveOnly = [...blockTypesOf(slide.node)].filter((type) => {
      const definition = presentation.registry.definition(type);
      return definition?.group === "block" && definition.liveOnly === true;
    });
    if (liveOnly.length > 0 && !steps.some((step) => step.print)) {
      problems.push({
        where: `slide "${slide.id}"`,
        what: `the live-only block "${liveOnly[0]}"`,
      });
    }
  }
  return problems;
}

/** The sentence `slidesend check` prints for one problem. */
export function printProblemMessage(problem: PrintProblem): string {
  return `${problem.where}: ${problem.what} would print as it never was. Add a print rule: print: { hide: true } to leave it out, or print: { replaceWith: ... , text: "..." } to say what paper should show.`;
}
