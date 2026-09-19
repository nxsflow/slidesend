/** Channel names clients subscribe to; topics are the session id or `<sessionId>/<activityId>`. */
export const channels = {
  /** Topic: the session id. Message: the new `Cursor`. */
  cursor: "cursor",
  /** Topic: `<sessionId>/<activityId>`. Message: the new `ActivityResponse`. */
  responses: "responses",
} as const;

/** The cadence at which clients send heartbeats (epic Risks 4: one write per device per 20 s). */
export const heartbeatMs = 20_000;

/** Where a session stands in the deck (spec §11). */
export interface Cursor {
  /** Position in the flat step list of the whole deck, from 0. */
  index: number;
  /** The slide at that position, so that a cursor survives small deck edits. */
  slideId: string;
  /** The step within that slide, from 0. */
  step: number;
  /** When the cursor moved here, in epoch ms. */
  at: number;
  /** The device that moved it, so that a window recognizes its own move. */
  from: string;
}

/** Where to move the cursor. */
export type CursorTarget = Pick<Cursor, "index" | "slideId" | "step">;

/** One response of one device to one activity (spec §6.4). */
export interface ActivityResponse {
  activityId: string;
  deviceId: string;
  /** The response itself: any JSON the activity defines, e.g. a choice or a text. */
  value: unknown;
  /** When it was written, in epoch ms. */
  at: number;
  /** Its store key; writing again under it corrects the response. */
  key: string;
}

/** The kinds of device that report presence (spec §11). */
export type DeviceRole = "stage" | "desk" | "phone";

/** One device that sent a heartbeat recently. */
export interface PresenceEntry {
  role: DeviceRole;
  deviceId: string;
  /** A readable, editable device label; desks set one so that warnings can name them. */
  label?: string;
  /** The last heartbeat, in epoch ms. */
  at: number;
}

/** Who is connected to a session. Phones are only counted. */
export interface Presence {
  stages: PresenceEntry[];
  desks: PresenceEntry[];
  phones: number;
}

/** How long the cursor stayed on one step, measured silently (spec §13). */
export interface StepTiming {
  index: number;
  slideId: string;
  step: number;
  /** Dwell time in ms. */
  ms: number;
  /** When the cursor left the step, in epoch ms. */
  at: number;
}
