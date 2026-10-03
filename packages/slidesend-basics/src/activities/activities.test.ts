import {
  type ActivityResponse,
  createRegistry,
  NodeValidationError,
} from "@nxsflow/slidesend-core";
import { describe, expect, it } from "vitest";
import { basics, countAnswers, countMatrix, pollList, pollMatrix, textList } from "../index";

const registry = createRegistry([basics()]);
const problems = (node: object) => {
  try {
    registry.parse("block", node);
  } catch (error) {
    if (error instanceof NodeValidationError) return error.issues.map((issue) => issue.message);
    throw error;
  }
  throw new Error("expected a NodeValidationError");
};

const response = (deviceId: string, value: unknown, at = 0): ActivityResponse => ({
  activityId: "mood",
  deviceId,
  value,
  at,
  key: `mood/${deviceId}/${at}`,
});

const questions = [
  {
    id: "weight",
    text: "Does weight matter?",
    short: "Weight",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "air",
    text: "Does the air matter?",
    short: "Air",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
];

describe("counting a poll", () => {
  it("counts one cell per participant, not per response", () => {
    const responses = [
      response("a", { weight: "yes", air: "yes" }),
      response("b", { weight: "no", air: "yes" }),
      // The same device answers again: a correction, not a second vote.
      response("a", { weight: "no", air: "yes" }, 1),
    ];
    expect(countMatrix(responses, "weight", "air")).toEqual({
      cells: { no: { yes: 2 } },
      answered: 2,
    });
  });

  it("ignores a participant who answered only one of the two questions", () => {
    const responses = [
      response("a", { weight: "yes" }),
      response("b", { weight: "yes", air: "no" }),
    ];
    expect(countMatrix(responses, "weight", "air")).toEqual({
      cells: { yes: { no: 1 } },
      answered: 1,
    });
  });

  it("counts the options of one question", () => {
    const responses = [
      response("a", { weight: "yes" }),
      response("b", { weight: "no" }),
      response("c", { weight: "yes" }),
    ];
    expect(countAnswers(responses, "weight")).toEqual({ yes: 2, no: 1 });
    expect(countAnswers(responses, "air")).toEqual({});
  });
});

describe("a block that shows a poll", () => {
  it("contributes the activity when it defines the poll itself", () => {
    const node = pollMatrix({ id: "mood", questions, message: "Two quick questions." });
    expect(registry.describe(node).steps).toEqual([
      {
        activity: {
          type: "poll",
          id: "mood",
          questions,
          message: "Two quick questions.",
        },
      },
    ]);
  });

  it("contributes nothing when it points at a poll asked elsewhere", () => {
    expect(registry.describe(pollMatrix({ of: "mood" })).steps).toEqual([{}]);
    expect(registry.describe(pollList({ of: "mood" })).steps).toEqual([{}]);
  });

  it("insists on exactly one of the two", () => {
    expect(problems(pollMatrix({}))).toEqual([
      "Either point at a poll with `of`, or define one here with `id` and `questions`.",
    ]);
    expect(problems(pollMatrix({ of: "mood", id: "mood", questions }))).toEqual([
      "Either point at a poll with `of`, or define one here with `id` and `questions`.",
    ]);
  });

  it("does the same for free text", () => {
    expect(registry.describe(textList({ id: "ask", prompt: "What else?" })).steps).toEqual([
      {
        activity: { type: "text", id: "ask", prompt: "What else?", multiple: false },
      },
    ]);
    expect(problems(textList({}))[0]).toMatch(/Either point at a question/);
  });
});
