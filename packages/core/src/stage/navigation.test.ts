import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineDeck,
  definePlugin,
  definePresentation,
  defineSlide,
  keyAction,
  type NavigationState,
  navigate,
  parseRoute,
  positionOf,
  stageFit,
  stepIndexOf,
} from "../index";
import { plainDesign } from "../testing";

/** A slide with as many steps as it says. */
const steps = defineSlide({
  type: "steps",
  schema: z.object({ count: z.number().int().min(1) }),
  steps: (data) => data.count,
  describe: (data) => ({ label: "steps", steps: Array.from({ length: data.count }, () => ({})) }),
  Component: () => null,
});

// Slides "a" (3 steps), "b" (1 step), "c" (2 steps): step indexes 0-2, 3, 4-5.
const presentation = definePresentation({
  deck: defineDeck({
    meta: { title: "Gravity", language: "en" },
    chapters: [{ id: "intro", title: "Intro" }],
    slides: [
      steps({ id: "a", chapter: "intro", count: 3 }),
      steps({ id: "b", chapter: "intro", count: 1 }),
      steps({ id: "c", chapter: "intro", count: 2 }),
    ],
  }),
  design: plainDesign,
  plugins: [definePlugin({ name: "steps", slides: [steps] })],
});

const at = (index: number, pinned = false): NavigationState => ({ index, pinned });

describe("stage fit", () => {
  it("scales the stage to the window and centers it by calculation", () => {
    expect(stageFit(1920, 1080)).toEqual({ scale: 1, left: 0, top: 0 });
    expect(stageFit(1512, 982)).toEqual({ scale: 0.7875, left: 0, top: 66 });
    expect(stageFit(3840, 1080)).toEqual({ scale: 1, left: 960, top: 0 });
    expect(stageFit(1280, 1024)).toMatchObject({ left: 0, top: 152 });
  });
});

describe("step arithmetic", () => {
  it("walks through a slide's steps, then to the next slide", () => {
    const moves = [0, 1, 2, 3].map((index) =>
      navigate(presentation, at(index), { type: "next" }, true),
    );
    expect(moves.map((move) => move.state.index)).toEqual([1, 2, 3, 4]);
    expect(moves.map((move) => move.send)).toEqual([1, 2, 3, 4]);
    expect(positionOf(presentation, 3)).toMatchObject({ slide: { id: "b" }, step: 0 });
  });

  it("goes back from a slide's first step into the last step of the slide before", () => {
    expect(navigate(presentation, at(3), { type: "previous" }, true).state.index).toBe(2);
    expect(positionOf(presentation, 2)).toMatchObject({ slide: { id: "a" }, step: 2 });
    expect(positionOf(presentation, 4)).toMatchObject({ slide: { id: "c" }, step: 0 });
  });

  it("stops at both ends without sending", () => {
    expect(navigate(presentation, at(0), { type: "previous" }, true)).toEqual({ state: at(0) });
    expect(navigate(presentation, at(5), { type: "next" }, true)).toEqual({ state: at(5) });
    expect(navigate(presentation, at(2), { type: "goto", index: 99 }, true).state.index).toBe(5);
  });

  it("finds a slide id and a step within it, clamped to the slide", () => {
    expect(stepIndexOf(presentation, "c")).toBe(4);
    expect(stepIndexOf(presentation, "c", 1)).toBe(5);
    expect(stepIndexOf(presentation, "a", 7)).toBe(2);
    expect(stepIndexOf(presentation, "missing")).toBeUndefined();
  });
});

describe("follow-only versus steering", () => {
  it("lets only a steering window move, and follows moves from elsewhere", () => {
    expect(navigate(presentation, at(1), { type: "next" }, false)).toEqual({ state: at(1) });
    expect(navigate(presentation, at(1), { type: "goto", index: 4 }, false)).toEqual({
      state: at(1),
    });
    expect(navigate(presentation, at(1), { type: "remote", index: 4 }, false)).toEqual({
      state: at(4),
    });
    expect(navigate(presentation, at(1), { type: "remote", index: 4 }, true).send).toBeUndefined();
  });

  it("moves a steering window to a deep link and tells the others", () => {
    expect(navigate(presentation, at(0), { type: "deepLink", index: 4 }, true)).toEqual({
      state: at(4),
      send: 4,
    });
  });

  it("pins a follow-only window to a deep link, and it stops following", () => {
    const pinned = navigate(presentation, at(0), { type: "deepLink", index: 4 }, false);
    expect(pinned).toEqual({ state: at(4, true) });
    expect(navigate(presentation, pinned.state, { type: "remote", index: 1 }, false).state).toEqual(
      at(4, true),
    );
  });
});

describe("keys", () => {
  it("map keyboard and presenter-remote keys", () => {
    expect(["ArrowRight", "ArrowDown", "PageDown", " "].map(keyAction)).toEqual([
      "next",
      "next",
      "next",
      "next",
    ]);
    expect(["ArrowLeft", "ArrowUp", "PageUp"].map(keyAction)).toEqual([
      "previous",
      "previous",
      "previous",
    ]);
    expect([keyAction("Home"), keyAction("End"), keyAction("x")]).toEqual([
      "first",
      "last",
      undefined,
    ]);
  });
});

describe("routes", () => {
  it("read the views from the address, with a deep link counted from 1", () => {
    expect(parseRoute("/stage/s-1a2b")).toEqual({ view: "stage", sessionId: "s-1a2b" });
    expect(parseRoute("/stage/local/", "?slide=falling&step=2")).toEqual({
      view: "stage",
      sessionId: "local",
      slide: "falling",
      step: 1,
    });
    expect(parseRoute("/stage/local", "?step=0")).toEqual({ view: "stage", sessionId: "local" });
    expect(parseRoute("/desk")).toEqual({ view: "desk" });
    expect(parseRoute("/print")).toEqual({ view: "print" });
    expect(parseRoute("/r/abc123")).toEqual({ view: "phone", joinToken: "abc123" });
    expect(parseRoute("/")).toEqual({ view: "phone" });
    expect(parseRoute("/stage")).toEqual({ view: "phone" });
    expect(parseRoute("/stage/a/b")).toEqual({ view: "phone" });
  });
});
