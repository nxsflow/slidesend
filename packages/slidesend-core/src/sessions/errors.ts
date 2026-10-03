/** Refuses an operator call without the right control secret. */
export class NotAuthorizedError extends Error {
  constructor() {
    super("This requires the control secret.");
    this.name = "NotAuthorizedError";
  }
}

/**
 * Refuses a participant or model call outside an open session. Phones recognize it by its name
 * and show the closed or idle page instead of an error.
 */
export class SessionClosedError extends Error {
  constructor() {
    super("The session is not open.");
    this.name = "SessionClosedError";
  }
}

/** Refuses an operation that the session's state does not allow. */
export class SessionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionStateError";
  }
}

/** Refuses input longer than its limit. */
export class LimitError extends Error {
  constructor(what: string, max: number) {
    super(`The ${what} is longer than ${max} characters.`);
    this.name = "LimitError";
  }
}
