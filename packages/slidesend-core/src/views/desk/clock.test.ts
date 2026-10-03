import { describe, expect, it } from "vitest";
import { formatDuration, lateMs, onTimeMs, talkClock } from "../../index";

const minute = 60_000;
const now = 1_000_000;

describe("the talk clock", () => {
  it("does not run before the first forward step", () => {
    const clock = talkClock({ now, plannedMinutes: 3 });
    expect(clock).toEqual({
      elapsedMs: 0,
      plannedMs: 3 * minute,
      deltaMs: -3 * minute,
      tone: "onTime",
      started: false,
    });
  });

  it("counts from the first forward step", () => {
    const clock = talkClock({ startedAt: now - 5 * minute, now, plannedMinutes: 5 });
    expect(clock).toMatchObject({ elapsedMs: 5 * minute, plannedMs: 5 * minute, deltaMs: 0 });
    expect(clock.started).toBe(true);
  });

  it("turns colour as the talk drifts from the plan", () => {
    const tone = (elapsedMinutes: number, plannedMinutes: number) =>
      talkClock({ startedAt: now - elapsedMinutes * minute, now, plannedMinutes }).tone;
    expect(tone(5, 5)).toBe("onTime");
    // Within a minute either way still counts as on time.
    expect(tone(5 + onTimeMs / minute, 5)).toBe("onTime");
    expect(tone(5, 5 + onTimeMs / minute)).toBe("onTime");
    expect(tone(3, 5)).toBe("ahead");
    expect(tone(7, 5)).toBe("behind");
    // Beyond three minutes behind, the talk is late.
    expect(tone(5 + lateMs / minute + 1, 5)).toBe("late");
  });

  it("never counts backwards before the start", () => {
    expect(talkClock({ startedAt: now + minute, now, plannedMinutes: 0 }).elapsedMs).toBe(0);
  });
});

describe("durations", () => {
  it("read as minutes and seconds, with hours when needed and a sign when asked", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(65_000, true)).toBe("+1:05");
    expect(formatDuration(-65_000, true)).toBe("−1:05");
    expect(formatDuration(-65_000)).toBe("−1:05");
  });
});
