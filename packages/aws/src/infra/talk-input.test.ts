import { describe, expect, it } from "vitest";
import { publicVariables, talkInput } from "./talk-input";

describe("the talk app's input", () => {
  it("hands the backend exactly the Vite variables the site was built with", () => {
    expect(
      publicVariables({
        VITE_SLIDESEND_AGENT: "1",
        VITE_SLIDESEND_PLATFORM: "aws",
        VITE_EMPTY: "",
        AWS_SECRET_ACCESS_KEY: "never",
        PATH: "/bin",
      }),
    ).toEqual({ VITE_SLIDESEND_AGENT: "1", VITE_SLIDESEND_PLATFORM: "aws" });
  });

  it("says which field is missing instead of failing in CloudFormation", () => {
    expect(() => talkInput(undefined)).toThrow("run `slidesend deploy`");
    expect(() => talkInput('{"stackName":"s"}')).toThrow('missing "projectRoot"');
  });
});
