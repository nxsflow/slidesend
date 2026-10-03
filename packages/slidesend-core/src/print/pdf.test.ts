import { describe, expect, it } from "vitest";
import { pageCountOf, pageCountProblem, pageSizeOf, pdfJobs, slugOf } from "./pdf";

describe("what slidesend pdf writes", () => {
  const presentation = {
    meta: { title: "How does gravity work?" },
    slides: [{ id: "a", index: 0, firstStep: 0, stepCount: 2 }],
    steps: [
      { index: 0, slideId: "a", step: 0, label: "A" },
      { index: 1, slideId: "a", step: 1, label: "A" },
    ],
  } as never;

  it("names the files after the talk", () => {
    expect(slugOf("How does gravity work?")).toBe("how-does-gravity-work");
    expect(slugOf("   ")).toBe("talk");
    expect(pdfJobs(presentation).map((job) => job.file)).toEqual([
      "dist/how-does-gravity-work.pdf",
      "dist/how-does-gravity-work-storyboard.pdf",
    ]);
  });

  it("knows in advance how many pages the talk prints: the cover plus its steps", () => {
    // One slide of two steps prints its last step only, plus the cover.
    expect(pdfJobs(presentation)[0]?.pages).toBe(2);
    // The storyboard's length depends on how its rows break, so it is not held to a number.
    expect(pdfJobs(presentation)[1]?.pages).toBeUndefined();
  });

  it("reads the page count from the PDF's root, not from a subtree", () => {
    // A page tree with an inner node: the first /Count is a part, the largest is the whole.
    expect(pageCountOf("<< /Type /Pages /Count 8 >> << /Type /Pages /Count 62 >>")).toBe(62);
    expect(pageCountOf("no counts here")).toBe(0);
  });

  it("says what is lost when the file does not match the talk", () => {
    const [print] = pdfJobs(presentation);
    expect(pageCountProblem(print as never, 2)).toBeUndefined();
    expect(pageCountProblem(print as never, 1)).toContain("has 1 page(s), but the talk prints 2");
  });

  it("prints slides landscape and the storyboard portrait", () => {
    const [print, board] = pdfJobs(presentation);
    expect(pageSizeOf(print as never)).toEqual({ width: "297mm", height: "210mm" });
    expect(pageSizeOf(board as never)).toEqual({ width: "210mm", height: "297mm" });
  });
});
