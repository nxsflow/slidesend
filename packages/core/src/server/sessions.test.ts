import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LimitError, NotAuthorizedError, SessionClosedError, SessionStateError } from "../index";
import { accessOf, createSessions, limits, requireLength, session } from "../server";
import { createMemoryPlatform, recordWrites } from "../testing";

const secret = "correct horse";
const minute = 60_000;
const at = (iso: string) => Date.parse(iso);

function setup(now = at("2026-11-05T12:00:00+01:00"), secrets = { control: secret }) {
  const platform = createMemoryPlatform({ secrets, now });
  const recorded = recordWrites(platform.server);
  const sessions = createSessions({ platform: recorded.server, defaultPlannedMinutes: 45 });
  return { clock: platform.clock, platform: recorded.server, sessions, writes: recorded.writes };
}

describe("creating sessions", () => {
  it("starts a live session as a draft with the defaults", async () => {
    const { sessions } = setup();
    const live = await sessions.create({ kind: "live", name: "Main hall" });
    expect(live).toMatchObject({
      kind: "live",
      name: "Main hall",
      state: "draft",
      plannedMinutes: 45,
      leadMinutes: 10,
      graceMinutes: 15,
      closedPageMinutes: 15,
      extendedMinutes: 0,
    });
    expect(live.joinToken).toBeUndefined();
    expect(await sessions.list()).toHaveLength(1);
  });

  it("gives a rehearsal a random join token", async () => {
    const { sessions } = setup();
    const a = await sessions.create({ kind: "rehearsal", name: "Dry run" });
    const b = await sessions.create({ kind: "rehearsal", name: "Dry run" });
    expect(a.joinToken).toMatch(/^[0-9a-f]{24}$/);
    expect(a.joinToken).not.toBe(b.joinToken);
  });

  it("requires a planned start with an offset", async () => {
    const { sessions } = setup();
    await expect(
      sessions.create({ kind: "live", name: "x", plannedStart: "2026-11-05T18:00:00" }),
    ).rejects.toThrow(/offset/);
  });
});

describe("state transitions", () => {
  it("opens and closes by hand, and never reopens", async () => {
    const { sessions, clock } = setup();
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    expect((await sessions.open(id)).state).toBe("open");
    clock.advance(5 * minute);
    const closed = await sessions.close(id);
    expect(closed).toMatchObject({ state: "closed", closedAt: clock.now() });
    await expect(sessions.open(id)).rejects.toThrow("is closed; it cannot be opened");
    await expect(sessions.arm(id)).rejects.toBeInstanceOf(SessionStateError);
  });

  it("arms only with a planned start, and disarms back to draft", async () => {
    const { sessions } = setup();
    const draft = await sessions.create({ kind: "live", name: "Main hall" });
    await expect(sessions.arm(draft.id)).rejects.toThrow("needs a planned start");
    await sessions.update(draft.id, { plannedStart: "2026-11-05T18:00:00+01:00" });
    expect((await sessions.arm(draft.id)).state).toBe("armed");
    expect((await sessions.disarm(draft.id)).state).toBe("draft");
  });

  it("opens an armed session leadMinutes before its start and closes it after planned + grace", async () => {
    const { sessions, clock } = setup();
    const { id } = await sessions.create({
      kind: "live",
      name: "Main hall",
      plannedStart: "2026-11-05T18:00:00+01:00",
      plannedMinutes: 30,
    });
    await sessions.arm(id);
    clock.set(at("2026-11-05T17:49:59+01:00"));
    expect((await sessions.get(id)).state).toBe("armed");
    clock.set(at("2026-11-05T17:50:00+01:00"));
    expect(await sessions.get(id)).toMatchObject({
      state: "open",
      openedAt: at("2026-11-05T17:50:00+01:00"),
      closesAt: at("2026-11-05T18:45:00+01:00"),
    });
    clock.set(at("2026-11-05T18:45:00+01:00"));
    expect(await sessions.get(id)).toMatchObject({
      state: "closed",
      closedAt: at("2026-11-05T18:45:00+01:00"),
    });
  });

  it("closes a session opened by hand after planned + grace, counted from the talk start", async () => {
    const { sessions, clock } = setup();
    const opened = clock.now();
    const { id } = await sessions.create({ kind: "live", name: "Main hall", graceMinutes: 5 });
    expect((await sessions.open(id)).closesAt).toBe(opened + 50 * minute);
    clock.advance(10 * minute);
    expect((await sessions.markStarted(id)).closesAt).toBe(opened + 60 * minute);
    clock.advance(1 * minute);
    expect((await sessions.markStarted(id)).startedAt).toBe(opened + 10 * minute);
  });

  it("extends a running session, and keeps an armed one that opened on its own open", async () => {
    const { sessions, clock } = setup();
    const { id } = await sessions.create({
      kind: "live",
      name: "Main hall",
      plannedStart: "2026-11-05T18:00:00+01:00",
      plannedMinutes: 30,
    });
    await sessions.arm(id);
    clock.set(at("2026-11-05T18:40:00+01:00"));
    const extended = await sessions.extend(id, 20);
    expect(extended).toMatchObject({ state: "open", closesAt: at("2026-11-05T19:05:00+01:00") });
    await expect(sessions.disarm(id)).rejects.toThrow(/is open; it cannot be disarmed/);
  });

  it("edits only drafts and armed sessions", async () => {
    const { sessions } = setup();
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    expect((await sessions.update(id, { name: "Big hall" })).name).toBe("Big hall");
    await sessions.open(id);
    await expect(sessions.update(id, { name: "Late" })).rejects.toThrow(
      "is open; it cannot be edited",
    );
  });
});

describe("daylight saving time", () => {
  it("opens an armed session a real hour before a start right after clocks go back", async () => {
    // Berlin goes from 03:00 CEST back to 02:00 CET on 2026-10-25.
    const { sessions, clock } = setup(at("2026-10-24T12:00:00+02:00"));
    const { id } = await sessions.create({
      kind: "live",
      name: "Night talk",
      plannedStart: "2026-10-25T02:30:00+01:00",
      leadMinutes: 60,
    });
    const armed = await sessions.arm(id);
    expect(armed.opensAt).toBe(at("2026-10-25T02:30:00+02:00"));
    clock.set(at("2026-10-25T02:29:00+02:00"));
    expect((await sessions.get(id)).state).toBe("armed");
    clock.set(at("2026-10-25T02:30:00+02:00"));
    expect((await sessions.get(id)).state).toBe("open");
  });

  it("closes after the real planned length across clocks going forward", async () => {
    // Berlin goes from 02:00 CET to 03:00 CEST on 2026-03-29.
    const { sessions } = setup(at("2026-03-28T12:00:00+01:00"));
    const { id } = await sessions.create({
      kind: "live",
      name: "Night talk",
      plannedStart: "2026-03-29T01:30:00+01:00",
      plannedMinutes: 60,
      graceMinutes: 0,
    });
    expect((await sessions.arm(id)).closesAt).toBe(at("2026-03-29T03:30:00+02:00"));
  });
});

describe("one open live session at a time", () => {
  it("refuses a second open live session, and allows a rehearsal next to it", async () => {
    const { sessions } = setup();
    const a = await sessions.create({ kind: "live", name: "Morning" });
    const b = await sessions.create({ kind: "live", name: "Evening" });
    const rehearsal = await sessions.create({ kind: "rehearsal", name: "Dry run" });
    await sessions.open(a.id);
    await expect(sessions.open(b.id)).rejects.toThrow(
      'The live session "Morning" is open at the same time; close or disarm it first.',
    );
    expect((await sessions.open(rehearsal.id)).state).toBe("open");
    await sessions.close(a.id);
    expect((await sessions.open(b.id)).state).toBe("open");
  });

  it("refuses to arm a live session whose window overlaps another one's", async () => {
    const { sessions } = setup();
    const plan = (name: string, plannedStart: string) =>
      sessions.create({ kind: "live", name, plannedStart, plannedMinutes: 60 });
    const first = await plan("First", "2026-11-05T18:00:00+01:00");
    const overlapping = await plan("Overlapping", "2026-11-05T19:00:00+01:00");
    const later = await plan("Later", "2026-11-05T20:00:00+01:00");
    await sessions.arm(first.id);
    await expect(sessions.arm(overlapping.id)).rejects.toThrow('"First" is armed');
    expect((await sessions.arm(later.id)).state).toBe("armed");
  });
});

describe("lazy evaluation", () => {
  it("closes a forgotten session on access, without writing anything", async () => {
    const { sessions, clock, writes } = setup();
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    await sessions.open(id);
    const before = writes.length;
    clock.advance(59 * minute);
    expect((await sessions.get(id)).state).toBe("open");
    clock.advance(1 * minute);
    expect((await sessions.get(id)).state).toBe("closed");
    expect((await sessions.list())[0]?.state).toBe("closed");
    await expect(sessions.guards.requireOpenSession(id)).rejects.toBeInstanceOf(SessionClosedError);
    expect(writes.length).toBe(before);
  });
});

describe("which session a phone belongs to", () => {
  it("follows the live session, then its closed page, then idle", async () => {
    const { sessions, clock } = setup();
    expect(await sessions.resolvePhone()).toEqual({ page: "idle" });
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    expect(await sessions.resolvePhone()).toEqual({ page: "idle" });
    await sessions.open(id);
    expect(await sessions.resolvePhone()).toEqual({ page: "open", sessionId: id, kind: "live" });
    await sessions.close(id);
    clock.advance(14 * minute);
    expect(await sessions.resolvePhone()).toEqual({ page: "closed", sessionId: id, kind: "live" });
    clock.advance(1 * minute);
    expect(await sessions.resolvePhone()).toEqual({ page: "idle" });
  });

  it("finds a rehearsal only by its join token", async () => {
    const { sessions } = setup();
    const rehearsal = await sessions.create({ kind: "rehearsal", name: "Dry run" });
    await sessions.open(rehearsal.id);
    expect(await sessions.resolvePhone()).toEqual({ page: "idle" });
    expect(await sessions.resolvePhone(rehearsal.joinToken)).toEqual({
      page: "open",
      sessionId: rehearsal.id,
      kind: "rehearsal",
    });
    expect(await sessions.resolvePhone("0".repeat(24))).toEqual({ page: "idle" });
  });
});

describe("guards", () => {
  it("classifies every server method as open, control-guarded or session-guarded", () => {
    const { sessions } = setup();
    expect(accessOf(sessions.api)).toEqual({
      phoneSession: "open",
      sessionJoin: "control",
      controlCheck: "control",
      sessionList: "control",
      sessionCreate: "control",
      sessionUpdate: "control",
      sessionArm: "control",
      sessionDisarm: "control",
      sessionOpen: "control",
      sessionExtend: "control",
      sessionClose: "control",
    });
  });

  it("refuses every operator call without the right secret, and writes nothing", async () => {
    const { sessions, writes } = setup();
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    const before = [...writes];
    const { api } = sessions;
    const calls: Record<string, (key: string) => Promise<unknown>> = {
      controlCheck: (key) => api.controlCheck(key),
      sessionJoin: (key) => api.sessionJoin(key, id),
      sessionList: (key) => api.sessionList(key),
      sessionCreate: (key) => api.sessionCreate(key, { kind: "live", name: "Sneaky" }),
      sessionUpdate: (key) => api.sessionUpdate(key, id, { name: "Sneaky" }),
      sessionArm: (key) => api.sessionArm(key, id),
      sessionDisarm: (key) => api.sessionDisarm(key, id),
      sessionOpen: (key) => api.sessionOpen(key, id),
      sessionExtend: (key) => api.sessionExtend(key, id, 10),
      sessionClose: (key) => api.sessionClose(key, id),
    };
    const guarded = Object.entries(accessOf(api)).filter(([, access]) => access === "control");
    expect(Object.keys(calls).sort()).toEqual(guarded.map(([name]) => name).sort());
    for (const [name, call] of Object.entries(calls)) {
      for (const key of ["wrong", "", undefined as unknown as string]) {
        await expect(call(key), name).rejects.toBeInstanceOf(NotAuthorizedError);
      }
    }
    expect(writes).toEqual(before);
    expect(await api.controlCheck(secret)).toBe(true);
    expect((await api.sessionOpen(secret, id)).state).toBe("open");
  });

  it("refuses control when the platform has no control secret", async () => {
    const { sessions } = setup(undefined, {} as { control: string });
    await expect(sessions.api.controlCheck("anything")).rejects.toThrow('"control" is not set');
  });

  it("refuses a session method outside an open session before it writes", async () => {
    const { sessions, platform, writes, clock } = setup();
    const responses = platform.store("responses", z.string());
    const respond = session(sessions.guards, async (sessionId: string, text: unknown) => {
      await responses.put(`${sessionId}/r`, requireLength(text, limits.responseChars, "response"));
    });
    const { id } = await sessions.create({ kind: "live", name: "Main hall" });
    const before = [...writes];
    for (const target of [id, "s-missing", "", undefined as unknown as string]) {
      await expect(respond(target, "yes")).rejects.toBeInstanceOf(SessionClosedError);
    }
    expect(writes).toEqual(before);

    await sessions.open(id);
    const opened = [...writes];
    await expect(respond(id, "x".repeat(limits.responseChars + 1))).rejects.toBeInstanceOf(
      LimitError,
    );
    expect(writes).toEqual(opened);
    await respond(id, "yes");
    expect(writes).toEqual([...opened, `put responses ${id}/r`]);

    clock.advance(61 * minute);
    await expect(respond(id, "late")).rejects.toBeInstanceOf(SessionClosedError);
  });
});
