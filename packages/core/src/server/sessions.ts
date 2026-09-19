import { z } from "zod";
import type { PlatformServer } from "../platform/contract";
import { effectiveSession, openWindow, phonePage } from "../sessions/effective";
import {
  LimitError,
  NotAuthorizedError,
  SessionClosedError,
  SessionStateError,
} from "../sessions/errors";
import type { PhoneSession, Session, SessionRecord } from "../sessions/types";
import { type Access, control, type Guards, open, type ServerApi } from "./api";

/** The name of the platform secret that grants control (spec §11). */
export const controlSecretName = "control";

/** Default length limits for participant input (spec §9). */
export const limits = {
  /** Characters in one response to an activity. */
  responseChars: 500,
  /** Characters in one chat message. */
  chatMessageChars: 2000,
} as const;

/** Throws a `LimitError` unless `value` is a string of at most `max` characters. */
export function requireLength(value: unknown, max: number, what: string): string {
  if (typeof value !== "string") throw new LimitError(what, max);
  if (value.length > max) throw new LimitError(what, max);
  return value;
}

const offsetDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, {
    message: "Expected an ISO date-time with offset, e.g. 2026-11-05T18:00:00+01:00.",
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Not a valid date-time." });

const recordSchema: z.ZodType<SessionRecord> = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["rehearsal", "live"]),
  plannedStart: z.string().optional(),
  plannedMinutes: z.number(),
  leadMinutes: z.number(),
  graceMinutes: z.number(),
  extendedMinutes: z.number(),
  closedPageMinutes: z.number(),
  joinToken: z.string().optional(),
  state: z.enum(["draft", "armed", "open", "closed"]),
  createdAt: z.number(),
  openedAt: z.number().optional(),
  startedAt: z.number().optional(),
  closedAt: z.number().optional(),
});

const editable = {
  name: z.string().trim().min(1).max(100),
  plannedStart: offsetDateTime.optional(),
  plannedMinutes: z.number().positive().max(600),
  leadMinutes: z.number().min(0).max(240),
  graceMinutes: z.number().min(0).max(120),
  closedPageMinutes: z.number().min(0).max(1440),
};

/** What `sessionCreate` takes. Omitted durations use the defaults. */
export const sessionInputSchema = z.object({
  kind: z.enum(["rehearsal", "live"]),
  name: editable.name,
  plannedStart: editable.plannedStart,
  plannedMinutes: editable.plannedMinutes.optional(),
  leadMinutes: editable.leadMinutes.default(10),
  graceMinutes: editable.graceMinutes.default(15),
  closedPageMinutes: editable.closedPageMinutes.default(15),
});

/** What `sessionUpdate` takes: any editable field. */
export const sessionPatchSchema = z
  .object({
    name: editable.name,
    plannedStart: editable.plannedStart,
    plannedMinutes: editable.plannedMinutes,
    leadMinutes: editable.leadMinutes,
    graceMinutes: editable.graceMinutes,
    closedPageMinutes: editable.closedPageMinutes,
  })
  .partial();

const randomId = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/** Compares two strings in time that does not depend on where they differ. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

/** Options of `createSessions`. */
export interface SessionsOptions {
  platform: PlatformServer;
  /** A session's planned length unless given: the deck's planned minutes (spec §9). */
  defaultPlannedMinutes: number;
}

/**
 * Sessions on the platform contract (spec §9): every session is its own room; many live sessions
 * over time, at most one open at once; rehearsals next to them. Returns the operations, the
 * guards every other server method uses, and the session methods of the server API.
 */
export function createSessions({ platform, defaultPlannedMinutes }: SessionsOptions) {
  const store = platform.store("sessions", recordSchema);
  const key = (id: string) => `sessions/${id}`;

  async function records(): Promise<SessionRecord[]> {
    return (await store.list("sessions/")).map((entry) => entry.value);
  }

  async function record(id: unknown): Promise<SessionRecord> {
    const found = typeof id === "string" && id ? await store.get(key(id)) : undefined;
    if (!found) throw new SessionStateError(`There is no session "${String(id)}".`);
    return found;
  }

  /** The session as it is now. */
  async function get(id: string): Promise<Session> {
    return effectiveSession(await record(id), platform.now());
  }

  /** All sessions as they are now, newest first. */
  async function list(): Promise<Session[]> {
    const now = platform.now();
    return (await records())
      .map((stored) => effectiveSession(stored, now))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Writes `next` only if nobody changed the session since `previous` was read. */
  async function save(previous: SessionRecord, next: SessionRecord): Promise<Session> {
    await store.put(key(next.id), next, { ifMatches: previous });
    return effectiveSession(next, platform.now());
  }

  /**
   * Refuses to let a live session be open or armed while another live session's window
   * overlaps (spec §9: at most one open live session).
   */
  async function requireNoOtherLive(candidate: SessionRecord): Promise<void> {
    if (candidate.kind !== "live") return;
    const now = platform.now();
    const window = openWindow(effectiveSession(candidate, now));
    if (!window) return;
    for (const other of await list()) {
      if (other.id === candidate.id || other.kind !== "live") continue;
      const theirs = openWindow(other);
      if (theirs && theirs.from < window.to && window.from < theirs.to) {
        throw new SessionStateError(
          `The live session "${other.name}" is ${other.state} at the same time; close or disarm it first.`,
        );
      }
    }
  }

  function requireState(session: Session, allowed: readonly string[], action: string) {
    if (!allowed.includes(session.state)) {
      throw new SessionStateError(
        `The session "${session.name}" is ${session.state}; it cannot ${action}.`,
      );
    }
  }

  async function create(input: unknown): Promise<Session> {
    const parsed = sessionInputSchema.parse(input);
    const id = `s-${randomId(6)}`;
    const next: SessionRecord = {
      ...parsed,
      id,
      plannedMinutes: parsed.plannedMinutes ?? defaultPlannedMinutes,
      extendedMinutes: 0,
      state: "draft",
      createdAt: platform.now(),
      ...(parsed.kind === "rehearsal" ? { joinToken: randomId(12) } : {}),
    };
    await store.put(key(id), next, { ifAbsent: true });
    return effectiveSession(next, platform.now());
  }

  async function update(id: string, patch: unknown): Promise<Session> {
    const previous = await record(id);
    requireState(effectiveSession(previous, platform.now()), ["draft", "armed"], "be edited");
    const next = { ...previous, ...sessionPatchSchema.parse(patch) };
    if (next.state === "armed") await requireNoOtherLive(next);
    return save(previous, next);
  }

  async function arm(id: string): Promise<Session> {
    const previous = await record(id);
    requireState(effectiveSession(previous, platform.now()), ["draft"], "be armed");
    if (!previous.plannedStart) {
      throw new SessionStateError(
        `The session "${previous.name}" needs a planned start to be armed.`,
      );
    }
    const next: SessionRecord = { ...previous, state: "armed" };
    await requireNoOtherLive(next);
    return save(previous, next);
  }

  async function disarm(id: string): Promise<Session> {
    const previous = await record(id);
    requireState(effectiveSession(previous, platform.now()), ["armed"], "be disarmed");
    return save(previous, { ...previous, state: "draft" });
  }

  async function openNow(id: string): Promise<Session> {
    const previous = await record(id);
    requireState(effectiveSession(previous, platform.now()), ["draft", "armed"], "be opened");
    const next: SessionRecord = { ...previous, state: "open", openedAt: platform.now() };
    await requireNoOtherLive(next);
    return save(previous, next);
  }

  async function extend(id: string, minutes: unknown): Promise<Session> {
    const added = z.number().positive().max(240).parse(minutes);
    const previous = await record(id);
    const current = effectiveSession(previous, platform.now());
    requireState(current, ["armed", "open"], "be extended");
    // An armed session that has opened on its own is stored as open from here on.
    const next: SessionRecord = {
      ...previous,
      state: current.state,
      openedAt: current.openedAt ?? previous.openedAt,
      extendedMinutes: previous.extendedMinutes + added,
    };
    await requireNoOtherLive(next);
    return save(previous, next);
  }

  async function close(id: string): Promise<Session> {
    const previous = await record(id);
    const current = effectiveSession(previous, platform.now());
    requireState(current, ["armed", "open"], "be closed");
    return save(previous, {
      ...previous,
      state: "closed",
      openedAt: current.openedAt,
      closedAt: platform.now(),
    });
  }

  /** Starts the talk clock on the first forward step; later calls change nothing. */
  async function markStarted(id: string): Promise<Session> {
    const previous = await record(id);
    const current = effectiveSession(previous, platform.now());
    if (current.state !== "open" || previous.startedAt !== undefined) return current;
    return save(previous, {
      ...previous,
      state: "open",
      openedAt: current.openedAt,
      startedAt: platform.now(),
    });
  }

  /**
   * The session a phone belongs to (spec §9): with a join token, that rehearsal; without, the
   * open live session, or the live session whose closed page still shows.
   */
  async function resolvePhone(joinToken?: unknown): Promise<PhoneSession> {
    const now = platform.now();
    const sessions = await list();
    const candidates =
      typeof joinToken === "string" && joinToken
        ? sessions.filter(
            (s) => s.kind === "rehearsal" && s.joinToken && sameSecret(joinToken, s.joinToken),
          )
        : sessions.filter((s) => s.kind === "live");
    const current =
      candidates.find((s) => s.state === "open") ??
      candidates
        .filter((s) => phonePage(s, now) === "closed")
        .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0];
    const page = phonePage(current, now);
    return page === "idle" || !current
      ? { page }
      : { page, sessionId: current.id, kind: current.kind };
  }

  const guards: Guards = {
    async requireControl(secret) {
      const expected = await platform.secret(controlSecretName);
      if (typeof secret !== "string" || !sameSecret(secret, expected)) {
        throw new NotAuthorizedError();
      }
    },
    async requireOpenSession(sessionId) {
      const found =
        typeof sessionId === "string" && sessionId ? await store.get(key(sessionId)) : undefined;
      if (!found || effectiveSession(found, platform.now()).state !== "open") {
        throw new SessionClosedError();
      }
    },
  };

  const api = {
    phoneSession: open((joinToken?: string) => resolvePhone(joinToken)),
    controlCheck: control(guards, () => true),
    sessionList: control(guards, () => list()),
    sessionCreate: control(guards, (input: unknown) => create(input)),
    sessionUpdate: control(guards, (id: string, patch: unknown) => update(id, patch)),
    sessionArm: control(guards, (id: string) => arm(id)),
    sessionDisarm: control(guards, (id: string) => disarm(id)),
    sessionOpen: control(guards, (id: string) => openNow(id)),
    sessionExtend: control(guards, (id: string, minutes: number) => extend(id, minutes)),
    sessionClose: control(guards, (id: string) => close(id)),
  } satisfies ServerApi;

  return {
    get,
    list,
    create,
    update,
    arm,
    disarm,
    open: openNow,
    extend,
    close,
    markStarted,
    resolvePhone,
    guards,
    api,
  };
}

/** The operations and API returned by `createSessions`. */
export type Sessions = ReturnType<typeof createSessions>;

/** How every method of the sessions API is guarded; see `accessOf`. */
export type SessionsAccess = Record<keyof Sessions["api"], Access>;
