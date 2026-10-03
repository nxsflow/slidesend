/**
 * Who may call a server method:
 * - `open`: anyone, e.g. reading which session a phone belongs to;
 * - `control`: only with the control secret as first argument (every operator call);
 * - `session`: only with an open session's id as first argument (every participant and model
 *   call, spec §9).
 */
export type Access = "open" | "control" | "session";

/** A server method: JSON arguments in, a JSON result out. */
// biome-ignore lint/suspicious/noExplicitAny: methods take arbitrary JSON arguments
export type ServerMethod = (...args: any[]) => unknown;

/** The server methods a client can call, by name. */
export type ServerApi = Readonly<Record<string, ServerMethod>>;

const accessKey = Symbol.for("slidesend.access");

/** The checks the guarded wrappers run before a method's own code. */
export interface Guards {
  requireControl(secret: unknown): Promise<void>;
  requireOpenSession(sessionId: unknown): Promise<void>;
}

function tag<Method extends ServerMethod>(method: Method, access: Access): Method {
  Object.defineProperty(method, accessKey, { value: access });
  return method;
}

/** Marks a method anyone may call. */
export function open<Method extends ServerMethod>(method: Method): Method {
  return tag(method, "open");
}

/**
 * Wraps an operator method: the first argument must be the control secret, checked before the
 * method runs. The method receives the remaining arguments.
 */
export function control<Args extends unknown[], Result>(
  guards: Guards,
  method: (...args: Args) => Result,
): (secret: string, ...args: Args) => Promise<Awaited<Result>> {
  return tag(async (secret: string, ...args: Args): Promise<Awaited<Result>> => {
    await guards.requireControl(secret);
    return await method(...args);
  }, "control");
}

/**
 * Wraps a participant or model method: the first argument must be the id of an open session,
 * checked before the method runs. The method receives all arguments, including the session id.
 */
export function session<Args extends unknown[], Result>(
  guards: Guards,
  method: (sessionId: string, ...args: Args) => Result,
): (sessionId: string, ...args: Args) => Promise<Awaited<Result>> {
  return tag(async (sessionId: string, ...args: Args): Promise<Awaited<Result>> => {
    await guards.requireOpenSession(sessionId);
    return await method(sessionId, ...args);
  }, "session");
}

/** How each method of `api` is guarded, or `undefined` for a method that was not classified. */
export function accessOf(api: ServerApi): Record<string, Access | undefined> {
  return Object.fromEntries(
    Object.entries(api).map(([name, method]) => [
      name,
      (method as unknown as Record<symbol, Access | undefined>)[accessKey],
    ]),
  );
}
