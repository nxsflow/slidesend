/** Whether a session is a rehearsal or the real talk (spec §9). */
export type SessionKind = "rehearsal" | "live";

/**
 * The state of a session. `open` means phones may join; the talk clock starts separately, with
 * the first forward step (`startedAt`).
 */
export type SessionState = "draft" | "armed" | "open" | "closed";

/**
 * A session as stored. Only what the operator did is stored; whether an armed session has
 * opened, or an open one has closed on its own, is derived from these fields and the clock (see
 * `effectiveSession`), so that reading a session never writes.
 */
export interface SessionRecord {
  id: string;
  name: string;
  kind: SessionKind;
  /** The planned start as an ISO date-time with offset, e.g. `2026-11-05T18:00:00+01:00`. */
  plannedStart?: string;
  /** The planned length of the talk in minutes. */
  plannedMinutes: number;
  /** An armed session opens this long before `plannedStart`. */
  leadMinutes: number;
  /** A session closes this long after its planned end, unless extended. */
  graceMinutes: number;
  /** Minutes added by the operator while the session runs. */
  extendedMinutes: number;
  /** How long phones show the closed page after the session closed. */
  closedPageMinutes: number;
  /** The token in a rehearsal's phone address `/r/<joinToken>`; live sessions have none. */
  joinToken?: string;
  /** The state the operator set last. */
  state: SessionState;
  createdAt: number;
  /** When the operator opened the session; for an armed one, see `effectiveSession`. */
  openedAt?: number;
  /** When the talk clock started: the first forward step. */
  startedAt?: number;
  /** When the operator closed the session. */
  closedAt?: number;
}

/** A session as it is at a given moment, with the times it opens and closes. */
export interface Session extends Omit<SessionRecord, "state"> {
  state: SessionState;
  /** When the session opens (armed) or opened (open, closed), in epoch ms. */
  opensAt?: number;
  /** When the session closes (armed, open) or closed (closed), in epoch ms. */
  closesAt?: number;
}

/** Which page a phone shows (spec §9): the start page or an activity, the closed page, or idle. */
export type PhonePage = "open" | "closed" | "idle";

/** What a phone learns when it asks which session it belongs to. */
export interface PhoneSession {
  page: PhonePage;
  /** The session the phone belongs to; set while it is open or its closed page shows. */
  sessionId?: string;
  kind?: SessionKind;
}
