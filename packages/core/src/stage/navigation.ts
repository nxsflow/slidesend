import type { Presentation, ResolvedSlide } from "../deck/presentation";

/** The stage's fixed size in design pixels (spec §6.1). Every slide is laid out for it. */
export const stageWidth = 1920;
export const stageHeight = 1080;

/** How the stage fits a window: scale, and the offset that centers it. */
export interface StageFit {
  scale: number;
  left: number;
  top: number;
}

/**
 * Fits the 1920 × 1080 stage into a window of the given size and centers it. The offset is
 * calculated, not left to layout: a centering grid track grows to the child's 1920 px on a
 * narrower window and starts at 0, which pushes a scaled stage off to the right.
 */
export function stageFit(width: number, height: number): StageFit {
  const scale = Math.min(width / stageWidth, height / stageHeight);
  return {
    scale,
    left: Math.round((width - stageWidth * scale) / 2),
    top: Math.round((height - stageHeight * scale) / 2),
  };
}

/** Keeps a step index within the deck. */
export function clampStep(presentation: Presentation, index: number): number {
  return Math.min(presentation.steps.length - 1, Math.max(0, Math.round(index)));
}

/**
 * The step index of a slide id and a step within it, clamped to the slide's steps; `undefined`
 * if no slide has the id.
 */
export function stepIndexOf(
  presentation: Presentation,
  slideId: string,
  step = 0,
): number | undefined {
  const slide = presentation.slides.find((candidate) => candidate.id === slideId);
  if (!slide) return undefined;
  return slide.firstStep + Math.min(slide.stepCount - 1, Math.max(0, Math.round(step)));
}

/** The slide at a step index, and the step within that slide. */
export function positionOf(
  presentation: Presentation,
  index: number,
): { slide: ResolvedSlide; step: number } {
  const step = presentation.steps[clampStep(presentation, index)];
  const slide = step && presentation.slides[step.slideIndex];
  if (!step || !slide) throw new Error("The deck has no steps.");
  return { slide, step: step.step };
}

/** Where a stage window stands and whether it still follows the others. */
export interface NavigationState {
  index: number;
  /** A deep link fixed this follow-only view on a slide; moves from elsewhere are ignored. */
  pinned: boolean;
}

/** What can happen to a stage's position. */
export type NavigationAction =
  | { type: "next" }
  | { type: "previous" }
  | { type: "goto"; index: number }
  /** Another window moved the cursor. */
  | { type: "remote"; index: number }
  /** The page was opened with a deep link. */
  | { type: "deepLink"; index: number };

/**
 * The navigation rules (spec §11). Next and previous walk the flat step list, so previous from
 * a slide's first step lands on the last step of the slide before. Only a window that may steer
 * moves the cursor and reports the new index to send; a follow-only window takes moves from
 * elsewhere, unless a deep link pinned it to one slide.
 */
export function navigate(
  presentation: Presentation,
  state: NavigationState,
  action: NavigationAction,
  canSteer: boolean,
): { state: NavigationState; send?: number } {
  const moveTo = (index: number) => {
    const next = clampStep(presentation, index);
    return next === state.index ? { state } : { state: { ...state, index: next }, send: next };
  };
  switch (action.type) {
    case "next":
      return canSteer ? moveTo(state.index + 1) : { state };
    case "previous":
      return canSteer ? moveTo(state.index - 1) : { state };
    case "goto":
      return canSteer ? moveTo(action.index) : { state };
    case "remote":
      return state.pinned
        ? { state }
        : { state: { ...state, index: clampStep(presentation, action.index) } };
    case "deepLink":
      return canSteer
        ? moveTo(action.index)
        : { state: { index: clampStep(presentation, action.index), pinned: true } };
  }
}

/** The action a key stands for, including the keys presenter remotes send. */
export function keyAction(key: string): "next" | "previous" | "first" | "last" | undefined {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ":
      return "next";
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** A view the address points at (spec §9, Addresses). */
export type Route =
  | { view: "phone"; joinToken?: string }
  | { view: "stage"; sessionId: string; slide?: string; step?: number }
  | { view: "desk" }
  | { view: "print" }
  | { view: "storyboard" };

/**
 * Reads the view from an address. A stage takes a deep link `?slide=<id>&step=<n>`, with `n`
 * counted from 1 as people count. Anything unknown is the phone, so an address someone guesses
 * never lands on the stage or the desk.
 */
export function parseRoute(pathname: string, search = ""): Route {
  const path = pathname.replace(/\/+$/, "");
  const params = new URLSearchParams(search);
  const stage = /^\/stage\/([\w-]{1,64})$/.exec(path);
  if (stage) {
    const slide = params.get("slide") ?? undefined;
    const step = Number(params.get("step"));
    return {
      view: "stage",
      sessionId: stage[1] as string,
      ...(slide ? { slide } : {}),
      ...(Number.isInteger(step) && step >= 1 ? { step: step - 1 } : {}),
    };
  }
  if (path === "/desk") return { view: "desk" };
  if (path === "/print") return { view: "print" };
  if (path === "/storyboard") return { view: "storyboard" };
  const rehearsal = /^\/r\/([\w-]{1,64})$/.exec(path);
  if (rehearsal) return { view: "phone", joinToken: rehearsal[1] as string };
  return { view: "phone" };
}
