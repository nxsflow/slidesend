import type { PhonePage, Session, SessionRecord } from "./types";

const minute = 60_000;

/** `plannedStart` in epoch ms, or `undefined` if the session has none. */
export function plannedStartMs(record: SessionRecord): number | undefined {
  return record.plannedStart === undefined ? undefined : Date.parse(record.plannedStart);
}

/**
 * When a session that opened at `openedAt` closes on its own: its planned length plus grace and
 * extensions after the talk started, or after the later of planned start and opening if the
 * clock has not started yet.
 */
function closesAtAfter(record: SessionRecord, openedAt: number): number {
  const start = plannedStartMs(record) ?? openedAt;
  const base = record.startedAt ?? Math.max(start, openedAt);
  return base + (record.plannedMinutes + record.graceMinutes + record.extendedMinutes) * minute;
}

/**
 * The session as it is at `now`. An armed session opens `leadMinutes` before its planned start,
 * and every open session closes after its planned length plus grace; both are derived here, on
 * access, so no scheduler is needed and reading never writes (spec §9).
 */
export function effectiveSession(record: SessionRecord, now: number): Session {
  const { state, ...rest } = record;
  if (state === "armed") {
    const start = plannedStartMs(record);
    if (start === undefined) return { ...rest, state };
    const opensAt = start - record.leadMinutes * minute;
    const closesAt = closesAtAfter(record, opensAt);
    if (now < opensAt) return { ...rest, state, opensAt, closesAt };
    if (now < closesAt) return { ...rest, state: "open", openedAt: opensAt, opensAt, closesAt };
    return { ...rest, state: "closed", openedAt: opensAt, opensAt, closesAt, closedAt: closesAt };
  }
  if (state === "open" && record.openedAt !== undefined) {
    const closesAt = closesAtAfter(record, record.openedAt);
    const opensAt = record.openedAt;
    if (now < closesAt) return { ...rest, state, opensAt, closesAt };
    return { ...rest, state: "closed", opensAt, closesAt, closedAt: closesAt };
  }
  if (state === "closed") {
    return { ...rest, state, opensAt: record.openedAt, closesAt: record.closedAt };
  }
  return { ...rest, state };
}

/** The time span in which a session is or will be open, or `undefined` for draft and closed. */
export function openWindow(session: Session): { from: number; to: number } | undefined {
  if ((session.state === "armed" || session.state === "open") && session.opensAt !== undefined) {
    return { from: session.opensAt, to: session.closesAt ?? Number.POSITIVE_INFINITY };
  }
  return undefined;
}

/**
 * Which page a phone of this session shows at `now` (spec §9): while open, the start page or an
 * activity; for `closedPageMinutes` after closing, the closed page; otherwise idle.
 */
export function phonePage(session: Session | undefined, now: number): PhonePage {
  if (!session) return "idle";
  if (session.state === "open") return "open";
  if (
    session.state === "closed" &&
    session.closedAt !== undefined &&
    now < session.closedAt + session.closedPageMinutes * minute
  ) {
    return "closed";
  }
  return "idle";
}
