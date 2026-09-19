import type { Presentation } from "../deck/presentation";
import type { ActivityNode } from "../nodes/types";

/** An activity a phone shows, and why it is there. */
export interface VisibleActivity {
  activity: ActivityNode;
  /** The step it belongs to. */
  stepIndex: number;
  /** Whether it is the activity of the current step, or one that is kept from an earlier one. */
  current: boolean;
}

const activityId = (activity: ActivityNode) => String((activity as { id?: unknown }).id ?? "");

/**
 * Which activities a phone shows at a step (spec §6.4, §9): the current step's activity, plus
 * every earlier one that asked to stay — `keep: true` for the rest of the talk, or
 * `keep: { until: <slideId> }` until the deck reaches that slide. A kept activity disappears
 * when its slide has passed, and an activity is never listed twice.
 */
export function visibleActivities(
  presentation: Presentation,
  stepIndex: number,
): VisibleActivity[] {
  const step = presentation.steps[stepIndex];
  if (!step) return [];
  const slideIndexOf = (slideId: string) =>
    presentation.slides.find((slide) => slide.id === slideId)?.index;

  const seen = new Set<string>();
  const kept: VisibleActivity[] = [];
  for (let index = 0; index < stepIndex; index++) {
    const earlier = presentation.steps[index];
    const activity = earlier?.activity;
    if (!earlier || !activity) continue;
    const keep = (activity as { keep?: true | { until?: string } }).keep;
    if (!keep) continue;
    const until = typeof keep === "object" ? keep.until : undefined;
    if (until !== undefined) {
      const untilIndex = slideIndexOf(until);
      if (untilIndex === undefined || step.slideIndex >= untilIndex) continue;
    }
    const id = activityId(activity);
    if (seen.has(id)) continue;
    seen.add(id);
    kept.push({ activity, stepIndex: index, current: false });
  }

  const current = step.activity;
  if (!current) return kept;
  const id = activityId(current);
  return [
    { activity: current, stepIndex, current: true },
    ...kept.filter((entry) => activityId(entry.activity) !== id),
  ];
}
