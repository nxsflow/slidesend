/**
 * Does the content fit the stage? (spec §5.2, the render pass.)
 *
 * The stage is a fixed 1920 × 1080 surface with `overflow: hidden`, which is a blessing in a
 * room — nothing ever spills over the edge of the projection — and a trap while writing a talk:
 * a list one item too long simply loses its last line, silently, and nobody notices until they
 * are standing in front of it.
 *
 * So it is measured instead: every step, in the browser, against the stage's own box. The
 * measuring function below runs INSIDE the page, which is why it takes no imports and returns
 * plain data.
 */

/** What one step's measurement found. */
export interface OverflowFinding {
  slideId: string;
  /** The step within the slide, from 0. */
  step: number;
  /** How far the content reaches past the stage, in stage pixels. */
  overflowX: number;
  overflowY: number;
  /**
   * The smallest scale a `FitBox` had to apply to keep the content inside, or 1.
   *
   * This is the failure mode that actually happens: a template that fits its content does not
   * overflow, it SHRINKS — and a slide nobody can read from the back row passes every check
   * that only looks for things sticking out.
   */
  fit: number;
  /** A hint at what is too big: the offending element's tag and its first words. */
  what?: string;
}

/** How much a rounded pixel may lie before it counts as overflow. */
export const overflowTolerance = 2;

/**
 * How far content may be shrunk before the step counts as too full.
 *
 * A judgement, not a law: at 0.6 the stage's own type sizes are still legible from the back of
 * a room, below it they stop being. A talk that disagrees passes its own number.
 */
export const readableFit = 0.6;

/**
 * Measures the current step in the page. It is serialized into the browser, so it must stay
 * self-contained: no imports, no closure over anything outside.
 */
export function measureOverflow(): {
  overflowX: number;
  overflowY: number;
  fit: number;
  what?: string;
} {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return { overflowX: 0, overflowY: 0, fit: 1 };
  const frame = stage.getBoundingClientRect();
  // The surface is scaled, so everything is measured in the same scaled space and divided back
  // to stage pixels at the end: a report in screen pixels would mean nothing to a deck's author.
  const scale = frame.width / 1920 || 1;
  let overflowX = 0;
  let overflowY = 0;
  let what: string | undefined;
  const slide = stage.querySelector("[data-slide-id][data-presence]:not([aria-hidden])") ?? stage;
  for (const element of slide.querySelectorAll("*")) {
    // What is hidden from a screen reader is not on the stage for a reader either: a carousel
    // marks the panels beside the current one that way, and they may peek in during a step.
    if (element.closest('[aria-hidden="true"]')) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      continue;
    }
    // An element that scrolls or is clipped on purpose is its own business.
    const parentStyle = element.parentElement ? getComputedStyle(element.parentElement) : undefined;
    if (parentStyle && parentStyle.overflow !== "visible") continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    // Only what is ON the stage can overflow it. A carousel keeps its other panels beside the
    // stage on purpose, and a template may park anything out there; counting those would report
    // the layout itself as a fault. Something that touches the stage and sticks out does not.
    const touches =
      box.left < frame.right &&
      box.right > frame.left &&
      box.top < frame.bottom &&
      box.bottom > frame.top;
    if (!touches) continue;
    const right = box.right - frame.right;
    const bottom = box.bottom - frame.bottom;
    const left = frame.left - box.left;
    const top = frame.top - box.top;
    const x = Math.max(right, left, 0);
    const y = Math.max(bottom, top, 0);
    if (x > overflowX || y > overflowY) {
      if (x > overflowX) overflowX = x;
      if (y > overflowY) overflowY = y;
      what = `${element.tagName.toLowerCase()} “${(element.textContent ?? "").trim().slice(0, 40)}”`;
    }
  }
  // How hard the layout had to work to keep it in: a template that fits its content reports
  // the scale it applied, and a scale far below 1 is a slide nobody can read.
  let fit = 1;
  for (const box of slide.querySelectorAll("[data-fit]")) {
    if (box.closest('[aria-hidden="true"]')) continue;
    const value = Number((box as HTMLElement).dataset.fit);
    if (Number.isFinite(value) && value < fit) {
      fit = value;
      if (value < 0.999) {
        what = `${(box.textContent ?? "").trim().slice(0, 40)}`;
      }
    }
  }
  return {
    overflowX: Math.round(overflowX / scale),
    overflowY: Math.round(overflowY / scale),
    fit,
    ...(what ? { what } : {}),
  };
}

/** Whether a measurement means the step is too full: it sticks out, or it was shrunk too far. */
export function overflows(
  finding: { overflowX: number; overflowY: number; fit?: number },
  minimumFit = readableFit,
): boolean {
  return (
    finding.overflowX > overflowTolerance ||
    finding.overflowY > overflowTolerance ||
    (finding.fit ?? 1) < minimumFit
  );
}

/** The sentence `slidesend check` prints for one finding: slide, step, and by how much. */
export function overflowMessage(finding: OverflowFinding, minimumFit = readableFit): string {
  const where = `slide "${finding.slideId}" step ${finding.step + 1}`;
  const what = finding.what ? ` (${finding.what})` : "";
  const by = [
    finding.overflowX > overflowTolerance ? `${finding.overflowX}px wide` : "",
    finding.overflowY > overflowTolerance ? `${finding.overflowY}px tall` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  if (by) return `${where}: the content is ${by} too much for the stage${what}.`;
  const percent = Math.round((finding.fit ?? 1) * 100);
  return `${where}: the content had to be shrunk to ${percent}% to fit, which is too small to read from the back${what}. Say less here, or split the step.`;
}

/** The address of one step on the stage, as a deep link; steps count from 1 in a link. */
export function stepLink(slideId: string, step: number): string {
  return `/stage/local?slide=${encodeURIComponent(slideId)}&step=${step + 1}`;
}
