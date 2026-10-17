import type { ServerApi } from "./api";

/** A platform's error that reaches the client verbatim, such as AWS Blocks' `ApiError`. */
export type PublicErrorClass = new (
  message: string,
  status: number,
  options: { name: string; cause: unknown },
) => Error;

/** The errors slidesend raises for the client to read, by name, with their HTTP status. */
const statusByName: Readonly<Record<string, number>> = {
  NotAuthorizedError: 403,
  SessionClosedError: 409,
  SessionStateError: 409,
  LimitError: 400,
};

/**
 * Wraps every method of `api` so that slidesend's own errors (`NotAuthorizedError`,
 * `SessionClosedError`, `SessionStateError`, `LimitError`) are thrown again as `PublicError`,
 * with their name and message. A platform that hides an ordinary error's message from the client,
 * as AWS Blocks does, then still tells a phone that its session closed. Any other error is
 * rethrown as it is, and stays hidden.
 */
export function publicErrors<Api extends ServerApi>(api: Api, PublicError: PublicErrorClass): Api {
  return Object.fromEntries(
    Object.entries(api).map(([name, method]) => [
      name,
      async (...args: unknown[]) => {
        try {
          return await method(...args);
        } catch (error) {
          const status = error instanceof Error ? statusByName[error.name] : undefined;
          if (status === undefined) throw error;
          throw new PublicError((error as Error).message, status, {
            name: (error as Error).name,
            cause: error,
          });
        }
      },
    ]),
  ) as Api;
}
