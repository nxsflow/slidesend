import { afterEach, describe, expect, it } from "vitest";
import {
  backoffMs,
  type Cursor,
  type CursorTransport,
  hostedTransport,
  localTransport,
  type PlatformClient,
  type SyncEnvironment,
} from "../index";
import { createServer } from "../server";
import { createMemoryPlatform, recordWrites } from "../testing";

const secret = "correct horse";
const at = (index: number) => ({ index, slideId: `slide-${index}`, step: 0 });

/** A controllable stand-in for the browser: wake-ups, visibility and the pulse by hand. */
function fakeEnvironment() {
  const wake = new Set<() => void>();
  const pulses = new Set<() => void>();
  let visible = true;
  const environment: SyncEnvironment = {
    onWake(handler) {
      wake.add(handler);
      return () => wake.delete(handler);
    },
    isVisible: () => visible,
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    setInterval(handler) {
      pulses.add(handler);
      return handler;
    },
    clearInterval(handle) {
      pulses.delete(handle as () => void);
    },
  };
  return {
    environment,
    wake: () => {
      for (const handler of wake) handler();
    },
    pulse: () => {
      for (const handler of pulses) handler();
    },
    setVisible: (value: boolean) => {
      visible = value;
    },
  };
}

async function until(check: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const open: CursorTransport[] = [];
afterEach(() => {
  for (const transport of open.splice(0)) transport.close();
});
const track = <T extends CursorTransport>(transport: T) => {
  open.push(transport);
  return transport;
};

async function setup() {
  const memory = createMemoryPlatform({ secrets: { control: secret } });
  memory.clock.set(Date.now());
  const recorded = recordWrites(memory.server);
  const server = createServer({ platform: recorded.server, defaultPlannedMinutes: 30 });
  const { id: sessionId } = await server.sessions.create({ kind: "live", name: "Main hall" });
  await server.sessions.open(sessionId);
  const tick = () => memory.clock.advance(10);
  const desk = memory.connect(server.api);
  const phone = memory.connect(server.api);
  const fake = fakeEnvironment();
  const steering = track(
    hostedTransport({ platform: desk.client, sessionId, secret, environment: fake.environment }),
  );
  return { memory, server, sessionId, desk, phone, fake, steering, writes: recorded.writes, tick };
}

function follow(transport: CursorTransport) {
  const seen: Cursor[] = [];
  transport.onCursor((cursor) => seen.push(cursor));
  return seen;
}

describe("hosted transport", () => {
  it("catches up on two missed moves after a reconnect, without a new move", async () => {
    const { phone, sessionId, steering, fake, tick } = await setup();
    const follower = track(
      hostedTransport({ platform: phone.client, sessionId, environment: fake.environment }),
    );
    const seen = follow(follower);
    steering.send(at(1));
    await until(() => seen.at(-1)?.index === 1);

    phone.setConnected(false);
    tick();
    steering.send(at(2));
    await pause(200);
    tick();
    steering.send(at(3));
    await pause(200);
    expect(seen.at(-1)?.index).toBe(1);

    phone.setConnected(true);
    await until(() => seen.at(-1)?.index === 3);
    expect(seen.map((cursor) => cursor.index)).toEqual([1, 3]);
  });

  it("fetches the cursor when the page wakes up and on the pulse while visible", async () => {
    const { phone, sessionId, steering, fake, tick } = await setup();
    // A subscription that never delivers: only the fetches can catch up.
    const deaf: PlatformClient = { ...phone.client, subscribe: () => () => {} };
    const follower = track(
      hostedTransport({ platform: deaf, sessionId, environment: fake.environment }),
    );
    const seen = follow(follower);
    tick();
    steering.send(at(4));
    await pause(200);
    expect(seen).toEqual([]);
    fake.wake();
    await until(() => seen.at(-1)?.index === 4);

    tick();
    steering.send(at(5));
    await pause(200);
    fake.setVisible(false);
    fake.pulse();
    await pause(50);
    expect(seen.at(-1)?.index).toBe(4);
    fake.setVisible(true);
    fake.pulse();
    await until(() => seen.at(-1)?.index === 5);
  });

  it("sends only the last of several rapid moves", async () => {
    const { steering, writes, server, sessionId } = await setup();
    const before = writes.filter((write) => write.startsWith("put cursor")).length;
    for (const index of [1, 2, 3, 4, 5]) steering.send(at(index));
    await pause(250);
    expect(writes.filter((write) => write.startsWith("put cursor")).length - before).toBe(1);
    expect((await server.runtime.cursor(sessionId))?.index).toBe(5);
  });

  it("ignores a fetched cursor that is older than the one it has", async () => {
    const { phone, sessionId, steering, fake, server, memory, tick } = await setup();
    const follower = track(
      hostedTransport({ platform: phone.client, sessionId, environment: fake.environment }),
    );
    const seen = follow(follower);
    tick();
    steering.send(at(6));
    await until(() => seen.at(-1)?.index === 6);
    const stale = { ...at(2), at: memory.clock.now() - 60_000, from: "elsewhere" };
    await server.runtime.stores.cursor.put(`${sessionId}/cursor`, stale);
    await follower.refresh();
    expect(seen.map((cursor) => cursor.index)).toEqual([6]);
  });

  it("retries a failed fetch with a growing, capped backoff", async () => {
    const delays: number[] = [];
    const refusing: PlatformClient = {
      call: async () => {
        throw new Error("The session is not open.");
      },
      subscribe: () => () => {},
      onStatus: () => () => {},
    };
    const fake = fakeEnvironment();
    const pending: (() => void)[] = [];
    const environment: SyncEnvironment = {
      ...fake.environment,
      setTimeout(handler, ms) {
        delays.push(ms);
        pending.push(handler);
        return handler;
      },
      clearTimeout() {},
    };
    const transport = track(hostedTransport({ platform: refusing, sessionId: "s-x", environment }));
    const status: boolean[] = [];
    transport.onStatus((connected) => status.push(connected));
    for (let round = 0; round < 6; round++) {
      await until(() => pending.length > 0);
      pending.shift()?.();
    }
    await until(() => delays.length >= 6);
    expect(delays.slice(0, 6)).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
    expect(backoffMs(10)).toBe(8000);
    expect(status).toEqual([false]);
  });

  it("sends nothing without the control secret", async () => {
    const { phone, sessionId, fake, writes } = await setup();
    const follower = track(
      hostedTransport({ platform: phone.client, sessionId, environment: fake.environment }),
    );
    const before = writes.length;
    follower.send(at(3));
    await pause(200);
    expect(writes.length).toBe(before);
  });
});

describe("local transport", () => {
  it("couples two views of one session through a BroadcastChannel", async () => {
    const fake = fakeEnvironment();
    const a = track(localTransport({ sessionId: "local", environment: fake.environment }));
    const b = track(localTransport({ sessionId: "local", environment: fake.environment }));
    const other = track(localTransport({ sessionId: "other", environment: fake.environment }));
    const seenByB = follow(b);
    const seenByOther = follow(other);
    a.send(at(2));
    await until(() => seenByB.at(-1)?.index === 2);
    expect(seenByB[0]?.from).toBe(a.id);

    // A window that opens later asks, and gets the current cursor.
    const late = track(localTransport({ sessionId: "local", environment: fake.environment }));
    const seenByLate = follow(late);
    await until(() => seenByLate.at(-1)?.index === 2);
    await pause(50);
    expect(seenByOther).toEqual([]);

    const status: boolean[] = [];
    a.onStatus((connected) => status.push(connected));
    expect(status).toEqual([true]);
    expect(a.kind).toBe("local");
  });
});
