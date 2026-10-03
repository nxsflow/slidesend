import { describe, expect, it } from "vitest";
import {
  type ActivityResponse,
  type CoreApi,
  channels,
  heartbeatMs,
  responseStore,
  typedClient,
} from "../index";
import { accessOf, createServer, maxResponsesPerDevice, presenceTtlMs } from "../server";
import { createMemoryPlatform, recordWrites } from "../testing";

const secret = "correct horse";
const second = 1000;
const minute = 60 * second;

async function setup() {
  const memory = createMemoryPlatform({ secrets: { control: secret } });
  const recorded = recordWrites(memory.server);
  const server = createServer({ platform: recorded.server, defaultPlannedMinutes: 30 });
  const live = await server.sessions.create({ kind: "live", name: "Main hall" });
  const rehearsal = await server.sessions.create({ kind: "rehearsal", name: "Dry run" });
  const connect = () => {
    const connection = memory.connect(server.api);
    return { ...connection, api: typedClient<CoreApi>(connection.client) };
  };
  return {
    memory,
    server,
    writes: recorded.writes,
    live: live.id,
    rehearsal: rehearsal.id,
    connect,
  };
}

const at = (index: number) => ({ index, slideId: `slide-${index}`, step: 0 });

describe("cursor", () => {
  it("moves only with control, and phones read it only while the session is open", async () => {
    const { live, connect, server } = await setup();
    const { api } = connect();
    await expect(api.cursorGoto("wrong", live, at(1), "desk-1")).rejects.toThrow("control secret");
    await api.cursorGoto(secret, live, at(1), "desk-1");
    expect(await api.cursorRead(secret, live)).toMatchObject({ index: 1, from: "desk-1" });
    await expect(api.cursorGet(live)).rejects.toThrow("not open");
    await server.sessions.open(live);
    expect(await api.cursorGet(live)).toMatchObject({ index: 1, slideId: "slide-1", step: 0 });
  });

  it("publishes every move on the session's topic", async () => {
    const { live, connect, memory } = await setup();
    const phone = connect();
    const moves: unknown[] = [];
    phone.client.subscribe(channels.cursor, live, (message) => moves.push(message));
    await connect().api.cursorGoto(secret, live, at(2), "desk-1");
    await memory.settle();
    expect(moves).toMatchObject([{ index: 2, from: "desk-1" }]);
  });

  it("refuses to move in a closed session", async () => {
    const { live, connect, server } = await setup();
    await server.sessions.open(live);
    await server.sessions.close(live);
    await expect(connect().api.cursorGoto(secret, live, at(1), "desk-1")).rejects.toThrow(
      "is closed",
    );
  });

  it("starts the talk clock with the first forward step", async () => {
    const { live, connect, server, memory } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await api.cursorGoto(secret, live, at(0), "desk-1");
    expect((await server.sessions.get(live)).startedAt).toBeUndefined();
    memory.clock.advance(5 * second);
    await api.cursorGoto(secret, live, at(1), "desk-1");
    const started = (await server.sessions.get(live)).startedAt;
    expect(started).toBe(memory.clock.now());
    memory.clock.advance(5 * second);
    await api.cursorGoto(secret, live, at(2), "desk-1");
    expect((await server.sessions.get(live)).startedAt).toBe(started);
  });

  it("measures the dwell time of every step silently, and discards it on request", async () => {
    const { live, connect, memory } = await setup();
    const { api } = connect();
    await api.cursorGoto(secret, live, at(0), "desk-1");
    memory.clock.advance(30 * second);
    await api.cursorGoto(secret, live, at(1), "desk-1");
    memory.clock.advance(60 * second);
    await api.cursorGoto(secret, live, at(2), "desk-1");
    memory.clock.advance(10 * second);
    await api.cursorGoto(secret, live, at(1), "desk-1");
    const timings = await api.timingsList(secret, live);
    expect(timings.map(({ index, ms }) => [index, ms])).toEqual([
      [0, 30 * second],
      [1, 60 * second],
      [2, 10 * second],
    ]);
    expect(await api.timingsDiscard(secret, live)).toBe(3);
    expect(await api.timingsList(secret, live)).toEqual([]);
  });
});

describe("responses", () => {
  it("corrects a device's response instead of adding one", async () => {
    const { live, connect, server } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await api.responseWrite(live, "mood", "phone-1", "yes");
    await api.responseWrite(live, "mood", "phone-1", "no");
    await api.responseWrite(live, "mood", "phone-2", "yes");
    expect((await api.responsesMine(live, "mood", "phone-1")).map((r) => r.value)).toEqual(["no"]);
    expect((await api.responsesFor(live, "mood")).map((r) => [r.deviceId, r.value])).toEqual([
      ["phone-1", "no"],
      ["phone-2", "yes"],
    ]);
    expect(await api.responsesRead(secret, live, "mood")).toHaveLength(2);
  });

  it("adds responses where the activity allows several, up to a limit", async () => {
    const { live, connect, server } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    for (let n = 0; n < maxResponsesPerDevice; n++) {
      await api.responseWrite(live, "words", "phone-1", `word ${n}`, { multiple: true });
    }
    expect(await api.responsesMine(live, "words", "phone-1")).toHaveLength(maxResponsesPerDevice);
    await expect(
      api.responseWrite(live, "words", "phone-1", "one more", { multiple: true }),
    ).rejects.toThrow("longer than 50");
  });

  it("limits the length of text and structured responses and checks ids", async () => {
    const { live, connect, server } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await expect(api.responseWrite(live, "t", "p", "x".repeat(501))).rejects.toThrow(
      "longer than 500",
    );
    await expect(api.responseWrite(live, "t", "p", { choices: "x".repeat(1000) })).rejects.toThrow(
      "longer than 1000",
    );
    await expect(api.responseWrite(live, "t/../x", "p", "hi")).rejects.toThrow("Expected an id");
    await expect(api.responseWrite(live, "t", "p", { choices: ["a", "b"] })).resolves.toMatchObject(
      {
        value: { choices: ["a", "b"] },
      },
    );
  });

  it("refuses responses outside an open session and writes nothing", async () => {
    const { live, connect, writes } = await setup();
    const before = [...writes];
    await expect(connect().api.responseWrite(live, "mood", "phone-1", "yes")).rejects.toThrow(
      "not open",
    );
    expect(writes).toEqual(before);
  });
});

describe("presence", () => {
  it("lists stages and desks with labels, counts phones, and forgets silent devices", async () => {
    const { live, connect, server, memory } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await api.presenceBeat(secret, live, "stage", "stage-1", "Beamer");
    await api.presenceBeat(secret, live, "desk", "desk-1", "Laptop");
    await api.presenceBeat(secret, live, "stage", "stage-2", undefined);
    await connect().client.call("presenceBeat", [secret, live, "stage", "stage-3", null]);
    await api.presencePhone(live, "phone-1");
    await api.presencePhone(live, "phone-2");
    expect(await api.presenceList(secret, live)).toMatchObject({
      stages: [
        { deviceId: "stage-1", label: "Beamer" },
        { deviceId: "stage-2" },
        { deviceId: "stage-3" },
      ],
      desks: [{ deviceId: "desk-1", label: "Laptop" }],
      phones: 2,
    });
    memory.clock.advance(presenceTtlMs - 1);
    await api.presencePhone(live, "phone-2");
    memory.clock.advance(1);
    expect(await api.presenceList(secret, live)).toMatchObject({
      stages: [],
      desks: [],
      phones: 1,
    });
  });

  it("stays within one write per device per heartbeat for 100 phones", async () => {
    const { live, connect, server, memory, writes } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    const phones = Array.from({ length: 100 }, (_, n) => `phone-${n}`);
    const before = writes.length;
    const duration = 10 * minute;
    for (let elapsed = 0; elapsed < duration; elapsed += heartbeatMs) {
      for (const phone of phones) await api.presencePhone(live, phone);
      memory.clock.advance(heartbeatMs);
    }
    const presenceWrites = writes.slice(before).filter((write) => write.startsWith("put presence"));
    expect(presenceWrites).toHaveLength(100 * (duration / heartbeatMs));
    expect(presenceWrites.length / (duration / second)).toBe(5);
  });
});

describe("export and deletion", () => {
  it("exports what a session holds", async () => {
    const { live, connect, server, memory } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await api.cursorGoto(secret, live, at(0), "desk-1");
    memory.clock.advance(second);
    await api.cursorGoto(secret, live, at(1), "desk-1");
    await api.responseWrite(live, "mood", "phone-1", "yes");
    const exported = await api.sessionExport(secret, live);
    expect(exported.session.id).toBe(live);
    expect(exported.cursor?.index).toBe(1);
    expect(exported.responses.map((r) => r.value)).toEqual(["yes"]);
    expect(exported.timings).toHaveLength(1);
  });

  it("deletes every key of a closed session and nothing of another", async () => {
    const { live, rehearsal, connect, server } = await setup();
    const { api } = connect();
    for (const id of [live, rehearsal]) {
      await server.sessions.open(id);
      await api.cursorGoto(secret, id, at(0), "desk-1");
      await api.cursorGoto(secret, id, at(1), "desk-1");
      await api.responseWrite(id, "mood", "phone-1", "yes");
      await api.presencePhone(id, "phone-1");
    }
    const plan = { minutes: { "intro:0": 1 }, hash: "abc", adoptedAt: 1, sessionId: rehearsal };
    await api.planAdopt(secret, plan);
    await expect(api.sessionDeleteData(secret, live)).rejects.toThrow("close it before deleting");
    await server.sessions.close(live);
    expect(await api.sessionDeleteData(secret, live)).toBe(4);
    const { plan: planStore, ...sessionStores } = server.runtime.stores;
    for (const store of Object.values(sessionStores)) {
      expect(await store.list(`${live}/`)).toEqual([]);
      expect((await store.list(`${rehearsal}/`)).length).toBeGreaterThan(0);
    }
    // The plan belongs to the talk: deleting a session's data does not take it along.
    expect(await api.planGet(secret)).toEqual(plan);
    expect((await planStore.list("plan/")).length).toBe(1);
  });

  it("keeps one adopted plan, and lets it be cleared", async () => {
    const { rehearsal, connect } = await setup();
    const { api } = connect();
    expect(await api.planGet(secret)).toBeUndefined();
    await api.planAdopt(secret, {
      minutes: { "intro:0": 1.5 },
      hash: "abc",
      adoptedAt: 1,
      sessionId: rehearsal,
    });
    await api.planAdopt(secret, {
      minutes: { "intro:0": 2 },
      hash: "def",
      adoptedAt: 2,
      sessionId: rehearsal,
    });
    // Adopting again replaces; there is one plan, not a history of them.
    expect(await api.planGet(secret)).toMatchObject({ hash: "def", minutes: { "intro:0": 2 } });
    await api.planClear(secret);
    expect(await api.planGet(secret)).toBeUndefined();
  });
});

describe("isolation", () => {
  it("never shows one session the cursor, responses, presence or timings of another", async () => {
    const { live, rehearsal, connect, server, memory } = await setup();
    const { api } = connect();
    await server.sessions.open(live);
    await server.sessions.open(rehearsal);
    await api.cursorGoto(secret, live, at(3), "desk-1");
    memory.clock.advance(second);
    await api.cursorGoto(secret, live, at(4), "desk-1");
    await api.responseWrite(live, "mood", "phone-1", "live answer");
    await api.presencePhone(live, "phone-1");
    await api.presenceBeat(secret, live, "stage", "stage-1");

    expect(await api.cursorGet(rehearsal)).toBeUndefined();
    expect(await api.responsesFor(rehearsal, "mood")).toEqual([]);
    expect(await api.responsesMine(rehearsal, "mood", "phone-1")).toEqual([]);
    expect(await api.presenceList(secret, rehearsal)).toEqual({ stages: [], desks: [], phones: 0 });
    expect(await api.timingsList(secret, rehearsal)).toEqual([]);
    expect(await api.cursorGet(live)).toMatchObject({ index: 4 });
  });
});

describe("guards", () => {
  it("classifies every method of core's server API", async () => {
    const { server } = await setup();
    expect(accessOf(server.api)).toEqual({
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
      cursorGet: "session",
      cursorRead: "control",
      cursorGoto: "control",
      planGet: "control",
      planAdopt: "control",
      planClear: "control",
      responseWrite: "session",
      responsesMine: "session",
      responsesFor: "session",
      responsesRead: "control",
      presencePhone: "session",
      presenceBeat: "control",
      presenceList: "control",
      timingsList: "control",
      timingsDiscard: "control",
      sessionExport: "control",
      sessionDeleteData: "control",
    });
  });

  it("refuses every guarded runtime method before it writes", async () => {
    const { live, connect, writes } = await setup();
    const { api } = connect();
    const before = [...writes];
    const refused = [
      api.cursorGoto("wrong", live, at(1), "desk-1"),
      api.presenceBeat("wrong", live, "stage", "stage-1"),
      api.timingsDiscard("wrong", live),
      api.sessionDeleteData("wrong", live),
      api.responseWrite(live, "mood", "phone-1", "yes"),
      api.presencePhone(live, "phone-1"),
    ];
    for (const call of refused) await expect(call).rejects.toThrow();
    expect(writes).toEqual(before);
    await expect(api.sessionDeleteData("wrong", live)).rejects.toThrow("control secret");
    await expect(api.presencePhone(live, "phone-1")).rejects.toThrow("not open");
  });
});

describe("client", () => {
  it("is not a thenable", async () => {
    const { connect } = await setup();
    const { api } = connect();
    expect((api as unknown as { then?: unknown }).then).toBeUndefined();
  });

  it("gives an activity a response store that follows all responses across a reconnect", async () => {
    const { live, connect, server, memory } = await setup();
    await server.sessions.open(live);
    const phone = connect();
    const other = connect();
    await other.api.responseWrite(live, "mood", "phone-2", "early");

    const store = responseStore({
      platform: phone.client,
      sessionId: live,
      activityId: "mood",
      deviceId: "phone-1",
    });
    const seen: ActivityResponse[][] = [];
    const stop = store.follow((responses) => seen.push(responses));
    await memory.settle();
    expect(seen.at(-1)?.map((r) => r.value)).toEqual(["early"]);

    await store.write("mine", undefined);
    await memory.settle();
    expect(seen.at(-1)?.map((r) => r.value)).toEqual(["early", "mine"]);

    phone.setConnected(false);
    await other.api.responseWrite(live, "mood", "phone-3", "while away");
    await memory.settle();
    expect(seen.at(-1)).toHaveLength(2);
    phone.setConnected(true);
    await memory.settle();
    await memory.settle();
    expect(seen.at(-1)?.map((r) => r.value)).toEqual(["early", "mine", "while away"]);

    await store.write("corrected");
    expect((await store.mine()).map((r) => r.value)).toEqual(["corrected"]);
    stop();
    const count = seen.length;
    await other.api.responseWrite(live, "mood", "phone-4", "after stop");
    await memory.settle();
    expect(seen).toHaveLength(count);
  });
});
