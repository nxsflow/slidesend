/** How the talk is doing against its plan (spec §12, Present). */
export type ClockTone = "ahead" | "onTime" | "behind" | "late";

/** The talk clock at a moment. */
export interface TalkClock {
  /** Since the first forward step, in ms; 0 before the talk started. */
  elapsedMs: number;
  /** What the deck plans up to the current step, in ms. */
  plannedMs: number;
  /** Elapsed minus planned; positive means the talk is behind. */
  deltaMs: number;
  tone: ClockTone;
  /** Whether the talk clock has started at all. */
  started: boolean;
}

/** Within this, the talk counts as on time. */
export const onTimeMs = 60_000;
/** Beyond this, being behind counts as late. */
export const lateMs = 180_000;

/** Reads the talk clock (spec §13): the plan is the sum of the minutes up to the current step. */
export function talkClock(options: {
  /** When the first forward step happened, in epoch ms. */
  startedAt?: number;
  now: number;
  /** The planned minutes before the current step, from the flat step list. */
  plannedMinutes: number;
}): TalkClock {
  const plannedMs = Math.round(options.plannedMinutes * 60_000);
  if (options.startedAt === undefined) {
    return { elapsedMs: 0, plannedMs, deltaMs: -plannedMs, tone: "onTime", started: false };
  }
  const elapsedMs = Math.max(0, options.now - options.startedAt);
  const deltaMs = elapsedMs - plannedMs;
  const tone: ClockTone =
    Math.abs(deltaMs) <= onTimeMs
      ? "onTime"
      : deltaMs < 0
        ? "ahead"
        : deltaMs <= lateMs
          ? "behind"
          : "late";
  return { elapsedMs, plannedMs, deltaMs, tone, started: true };
}

/** `mm:ss`, or `h:mm:ss` from an hour on; a leading sign when asked for, as a delta needs. */
export function formatDuration(ms: number, signed = false): string {
  const sign = ms < 0 ? "−" : signed ? "+" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  const seconds = String(total % 60).padStart(2, "0");
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours > 0
    ? `${sign}${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${sign}${minutes}:${seconds}`;
}
