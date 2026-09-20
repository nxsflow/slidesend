/**
 * The two ways a step fails to fit — it sticks out, or it was shrunk until nobody can read it —
 * and the sentence each of them prints.
 */
import { describe, expect, it } from "vitest";
import { overflowMessage, overflows, readableFit, stepLink } from "./overflow";

const finding = (
  over: Partial<{ overflowX: number; overflowY: number; fit: number; what: string }>,
) => ({
  slideId: "intro",
  step: 1,
  overflowX: 0,
  overflowY: 0,
  fit: 1,
  ...over,
});

describe("whether a step fits the stage", () => {
  it("lets a rounded pixel pass and catches a real overflow", () => {
    expect(overflows(finding({ overflowX: 2 }))).toBe(false);
    expect(overflows(finding({ overflowX: 3 }))).toBe(true);
    expect(overflows(finding({ overflowY: 40 }))).toBe(true);
  });

  it("counts content that had to be shrunk too far, which is what actually happens", () => {
    // A template that fits its content never overflows — it makes the text smaller, and a slide
    // nobody can read from the back passes every check that only looks for things sticking out.
    expect(overflows(finding({ fit: 0.9 }))).toBe(false);
    expect(overflows(finding({ fit: 0.4 }))).toBe(true);
    expect(overflows(finding({ fit: 0.4 }), 0.3)).toBe(false);
    expect(readableFit).toBeGreaterThan(0.5);
  });

  it("names slide and step, and says by how much", () => {
    expect(overflowMessage(finding({ overflowY: 312, what: "the list" }))).toBe(
      'slide "intro" step 2: the content is 312px tall too much for the stage (the list).',
    );
    expect(overflowMessage(finding({ overflowX: 40, overflowY: 12 }))).toContain(
      "40px wide and 12px tall",
    );
  });

  it("says what to do about a slide that was shrunk", () => {
    const message = overflowMessage(finding({ fit: 0.42 }));
    expect(message).toContain("shrunk to 42%");
    expect(message).toContain("Say less here, or split the step.");
  });

  it("addresses a step the way a deep link does, counting from 1", () => {
    expect(stepLink("why", 0)).toBe("/stage/local?slide=why&step=1");
    expect(stepLink("a b", 2)).toBe("/stage/local?slide=a%20b&step=3");
  });
});
