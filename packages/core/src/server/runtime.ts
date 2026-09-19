import { z } from "zod";
import type { PlatformServer } from "../platform/contract";
import { LimitError, SessionStateError } from "../sessions/errors";
import type {
  ActivityResponse,
  Cursor,
  CursorTarget,
  DeviceRole,
  Presence,
  PresenceEntry,
  StepTiming,
} from "../sessions/runtime-types";
import { channels } from "../sessions/runtime-types";
import type { Session } from "../sessions/types";
import { control, type ServerApi, session } from "./api";
import { createSessions, limits, requireLength, type Sessions } from "./sessions";

/** A heartbeat older than this counts as gone (three missed beats at the 20 s cadence). */
export const presenceTtlMs = 60_000;

/** How many responses one device may give to one activity that allows several. */
export const maxResponsesPerDevice = 50;

/** Characters in the JSON of a structured response, such as a set of poll choices. */
export const maxStructuredResponseChars = 1000;

const id = z
  .string()
  .regex(/^[\w-]{1,64}$/, { message: "Expected an id of letters, digits, _ or -." });
const cursorSchema: z.ZodType<Cursor> = z.object({
  index: z.number().int().min(0),
  slideId: z.string().min(1),
  step: z.number().int().min(0),
  at: z.number(),
  from: z.string(),
});
const targetSchema = z.object({
  index: z.number().int().min(0),
  slideId: z.string().min(1).max(200),
  step: z.number().int().min(0),
});
const responseSchema: z.ZodType<ActivityResponse> = z.object({
  activityId: z.string(),
  deviceId: z.string(),
  value: z.unknown(),
  at: z.number(),
  key: z.string(),
});
const presenceSchema: z.ZodType<PresenceEntry> = z.object({
  role: z.enum(["stage", "desk", "phone"]),
  deviceId: z.string(),
  label: z.string().optional(),
  at: z.number(),
});
const timingSchema: z.ZodType<StepTiming> = z.object({
  index: z.number(),
  slideId: z.string(),
  step: z.number(),
  ms: z.number(),
  at: z.number(),
});
// JSON turns a missing argument in the middle of a call into null.
const label = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .nullish()
  .transform((value) => value ?? undefined);

/** Everything a session holds besides its record, as the desk exports it (spec §12 Review). */
export interface SessionExport {
  session: Session;
  cursor?: Cursor;
  responses: ActivityResponse[];
  timings: StepTiming[];
}

function requireResponse(value: unknown): unknown {
  if (typeof value === "string") return requireLength(value, limits.responseChars, "response");
  const json = JSON.stringify(value);
  if (json === undefined) throw new LimitError("response", maxStructuredResponseChars);
  requireLength(json, maxStructuredResponseChars, "response");
  return value;
}

const pad = (value: number) => String(value).padStart(15, "0");

/**
 * The session-scoped runtime data (spec §9, §11): cursor, responses, presence and timings. Every
 * key starts with the session id, so sessions never see each other's data and a session's data
 * can be deleted by listing its partition.
 */
export function createRuntime({
  platform,
  sessions,
}: {
  platform: PlatformServer;
  sessions: Sessions;
}) {
  const stores = {
    cursor: platform.store("cursor", cursorSchema),
    responses: platform.store("responses", responseSchema),
    presence: platform.store("presence", presenceSchema),
    timings: platform.store("timings", timingSchema),
  };
  const cursorChannel = platform.channel(channels.cursor, cursorSchema);
  const responseChannel = platform.channel(channels.responses, responseSchema);
  const { guards } = sessions;

  const cursorKey = (sessionId: string) => `${sessionId}/cursor`;

  async function cursor(sessionId: string): Promise<Cursor | undefined> {
    return stores.cursor.get(cursorKey(id.parse(sessionId)));
  }

  /**
   * Moves the cursor, publishes it on the session's topic, records how long the previous step
   * was shown, and starts the talk clock on the first forward step.
   */
  async function goto(sessionId: string, target: unknown, from: unknown): Promise<Cursor> {
    const current = await sessions.get(id.parse(sessionId));
    if (current.state === "closed") {
      throw new SessionStateError(`The session "${current.name}" is closed.`);
    }
    const next: Cursor = {
      ...targetSchema.parse(target),
      at: platform.now(),
      from: id.parse(from),
    };
    const previous = await cursor(sessionId);
    await stores.cursor.put(cursorKey(sessionId), next);
    if (previous && previous.index !== next.index) {
      const timing: StepTiming = {
        index: previous.index,
        slideId: previous.slideId,
        step: previous.step,
        ms: next.at - previous.at,
        at: next.at,
      };
      await stores.timings.put(`${sessionId}/${pad(next.at)}-${previous.index}`, timing);
    }
    if (next.index > (previous?.index ?? 0)) await sessions.markStarted(sessionId);
    await cursorChannel.publish(sessionId, next);
    return next;
  }

  const responsePrefix = (sessionId: string, activityId: string) =>
    `${id.parse(sessionId)}/${id.parse(activityId)}/`;

  async function responses(sessionId: string, activityId: string): Promise<ActivityResponse[]> {
    return (await stores.responses.list(responsePrefix(sessionId, activityId))).map((e) => e.value);
  }

  /**
   * Writes a response. By default a device has one response per activity, and writing again
   * corrects it; with `multiple`, every write adds one, up to `maxResponsesPerDevice`.
   */
  async function respond(
    sessionId: string,
    activityId: string,
    deviceId: string,
    value: unknown,
    options?: { multiple?: boolean } | null,
  ): Promise<ActivityResponse> {
    const checked = requireResponse(value);
    const own = `${responsePrefix(sessionId, activityId)}${id.parse(deviceId)}/`;
    let key = `${own}0`;
    if (options?.multiple) {
      const existing = await stores.responses.list(own);
      if (existing.length >= maxResponsesPerDevice) {
        throw new LimitError("list of responses", maxResponsesPerDevice);
      }
      key = `${own}${pad(platform.now())}-${existing.length}`;
    }
    const response: ActivityResponse = {
      activityId,
      deviceId,
      value: checked,
      at: platform.now(),
      key,
    };
    await stores.responses.put(key, response);
    await responseChannel.publish(`${sessionId}/${activityId}`, response);
    return response;
  }

  async function mine(sessionId: string, activityId: string, deviceId: string) {
    const own = `${responsePrefix(sessionId, activityId)}${id.parse(deviceId)}/`;
    return (await stores.responses.list(own)).map((entry) => entry.value);
  }

  /** Records a heartbeat; it expires after `presenceTtlMs`. */
  async function beat(
    sessionId: string,
    role: DeviceRole,
    deviceId: unknown,
    deviceLabel?: unknown,
  ) {
    const entry: PresenceEntry = {
      role,
      deviceId: id.parse(deviceId),
      ...(role === "phone" ? {} : { label: label.parse(deviceLabel) }),
      at: platform.now(),
    };
    await stores.presence.put(`${id.parse(sessionId)}/${role}/${entry.deviceId}`, entry, {
      expiresAt: entry.at + presenceTtlMs,
    });
  }

  async function presence(sessionId: string): Promise<Presence> {
    const all = (await stores.presence.list(`${id.parse(sessionId)}/`)).map((entry) => entry.value);
    return {
      stages: all.filter((entry) => entry.role === "stage"),
      desks: all.filter((entry) => entry.role === "desk"),
      phones: all.filter((entry) => entry.role === "phone").length,
    };
  }

  async function timings(sessionId: string): Promise<StepTiming[]> {
    return (await stores.timings.list(`${id.parse(sessionId)}/`)).map((entry) => entry.value);
  }

  async function discardTimings(sessionId: string): Promise<number> {
    const entries = await stores.timings.list(`${id.parse(sessionId)}/`);
    for (const { key } of entries) await stores.timings.delete(key);
    return entries.length;
  }

  async function exportData(sessionId: string): Promise<SessionExport> {
    const all = await stores.responses.list(`${id.parse(sessionId)}/`);
    return {
      session: await sessions.get(sessionId),
      cursor: await cursor(sessionId),
      responses: all.map((entry) => entry.value),
      timings: await timings(sessionId),
    };
  }

  /**
   * Deletes everything a session holds besides its record: cursor, responses, presence and
   * timings. Refused while the session is open. Returns the number of deleted keys.
   */
  async function deleteData(sessionId: string): Promise<number> {
    const current = await sessions.get(id.parse(sessionId));
    if (current.state === "open" || current.state === "armed") {
      throw new SessionStateError(
        `The session "${current.name}" is ${current.state}; close it before deleting its data.`,
      );
    }
    let deleted = 0;
    for (const store of Object.values(stores)) {
      for (const { key } of await store.list(`${sessionId}/`)) {
        await store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  const api = {
    cursorGet: session(guards, (sessionId: string) => cursor(sessionId)),
    cursorRead: control(guards, (sessionId: string) => cursor(sessionId)),
    cursorGoto: control(guards, (sessionId: string, target: CursorTarget, from: string) =>
      goto(sessionId, target, from),
    ),
    responseWrite: session(
      guards,
      (
        sessionId: string,
        activityId: string,
        deviceId: string,
        value: unknown,
        options?: { multiple?: boolean },
      ) => respond(sessionId, activityId, deviceId, value, options),
    ),
    responsesMine: session(guards, (sessionId: string, activityId: string, deviceId: string) =>
      mine(sessionId, activityId, deviceId),
    ),
    responsesFor: session(guards, (sessionId: string, activityId: string) =>
      responses(sessionId, activityId),
    ),
    responsesRead: control(guards, (sessionId: string, activityId: string) =>
      responses(sessionId, activityId),
    ),
    presencePhone: session(guards, (sessionId: string, deviceId: string) =>
      beat(sessionId, "phone", deviceId),
    ),
    presenceBeat: control(
      guards,
      (sessionId: string, role: "stage" | "desk", deviceId: string, deviceLabel?: string) =>
        beat(sessionId, z.enum(["stage", "desk"]).parse(role), deviceId, deviceLabel),
    ),
    presenceList: control(guards, (sessionId: string) => presence(sessionId)),
    timingsList: control(guards, (sessionId: string) => timings(sessionId)),
    timingsDiscard: control(guards, (sessionId: string) => discardTimings(sessionId)),
    sessionExport: control(guards, (sessionId: string) => exportData(sessionId)),
    sessionDeleteData: control(guards, (sessionId: string) => deleteData(sessionId)),
  } satisfies ServerApi;

  return {
    cursor,
    goto,
    respond,
    responses,
    mine,
    beat,
    presence,
    timings,
    discardTimings,
    exportData,
    deleteData,
    stores,
    api,
  };
}

/** Options of `createServer`. */
export interface ServerOptions {
  platform: PlatformServer;
  /** A session's planned length unless given: the deck's planned minutes. */
  defaultPlannedMinutes: number;
}

/**
 * Core's server logic on the given platform: sessions and the runtime data, with one API object
 * whose every method is classified as open, control-guarded or session-guarded.
 */
export function createServer({ platform, defaultPlannedMinutes }: ServerOptions) {
  const sessions = createSessions({ platform, defaultPlannedMinutes });
  const runtime = createRuntime({ platform, sessions });
  const api = { ...sessions.api, ...runtime.api } satisfies ServerApi;
  return { sessions, runtime, api };
}

/** The API of core's server, as the typed client sees it. */
export type CoreApi = ReturnType<typeof createServer>["api"];
