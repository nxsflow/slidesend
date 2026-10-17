import { describe, expect, it } from "vitest";
import {
  LimitError,
  NotAuthorizedError,
  SessionClosedError,
  SessionStateError,
} from "../sessions/errors";
import { publicErrors } from "./public-errors";

/** Stands in for AWS Blocks' `ApiError`: what a platform sends to the client verbatim. */
class WireError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options: { name: string; cause: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = options.name;
  }
}

const failing = (error: unknown) =>
  publicErrors(
    {
      fail: async () => {
        throw error;
      },
    },
    WireError,
  ).fail();

describe("publicErrors", () => {
  it("passes a method's result through", async () => {
    const api = publicErrors({ add: (a: number, b: number) => a + b }, WireError);
    await expect(api.add(1, 2)).resolves.toBe(3);
  });

  it.each([
    [new NotAuthorizedError(), 403],
    [new SessionClosedError(), 409],
    [new SessionStateError("The session is closed."), 409],
    [new LimitError("answer", 10), 400],
  ])("sends %s to the client with its name, message and status", async (error, status) => {
    const sent = await failing(error).catch((thrown: unknown) => thrown);
    expect(sent).toBeInstanceOf(WireError);
    expect(sent).toMatchObject({ name: error.name, message: error.message, status });
    expect((sent as Error).cause).toBe(error);
  });

  it("leaves any other error as it is, so the platform keeps its details to itself", async () => {
    const internal = new Error("connect ECONNREFUSED 10.0.0.1:5432");
    await expect(failing(internal)).rejects.toBe(internal);
  });
});
