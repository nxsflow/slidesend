import { describe, expect, it } from "vitest";
import { awsClient } from "./client";

/** A stand-in for the Blocks channels: counts subscriptions and lets a test end them. */
function fakeBlocks() {
  const opened: { topic: string; closed: boolean; deliver(message: unknown): void }[] = [];
  const slidesend = {
    async subscribe(_channel: string, topic: string) {
      return {
        subscribe(options: { onMessage(message: unknown): void }) {
          const entry = { topic, closed: false, deliver: options.onMessage };
          opened.push(entry);
          return {
            unsubscribe: () => {
              entry.closed = true;
            },
            established: Promise.resolve(),
          };
        },
      };
    },
  };
  return { slidesend, opened };
}

function fakeWake() {
  const handlers = new Set<() => void>();
  return {
    onWake(handler: () => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    wake: () => {
      for (const handler of handlers) handler();
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the AWS client when the page wakes up", () => {
  it("opens every subscription afresh, once, and lets its listeners read again", async () => {
    const { slidesend, opened } = fakeBlocks();
    const signal = fakeWake();
    const client = awsClient({ slidesend }, { onWake: signal.onWake });
    const received: unknown[] = [];
    client.subscribe("cursor", "s-1", (message) => received.push(message));
    client.subscribe("responses", "s-1/mood", () => {});
    await settle();
    expect(opened.map((entry) => entry.topic)).toEqual(["s-1", "s-1/mood"]);
    const statuses: boolean[] = [];
    client.onStatus((up) => statuses.push(up));

    // A phone that comes back fires visibilitychange and pageshow together.
    signal.wake();
    signal.wake();
    await settle();
    await settle();
    expect(opened.map((entry) => entry.topic)).toEqual(["s-1", "s-1/mood", "s-1", "s-1/mood"]);
    expect(opened.map((entry) => entry.closed)).toEqual([true, true, false, false]);
    expect(statuses).toContain(true);

    // Messages arrive on the new subscription.
    opened[2]?.deliver({ index: 3 });
    expect(received).toEqual([{ index: 3 }]);
  });

  it("does not open again what was unsubscribed", async () => {
    const { slidesend, opened } = fakeBlocks();
    const signal = fakeWake();
    const client = awsClient({ slidesend }, { onWake: signal.onWake });
    const stop = client.subscribe("cursor", "s-1", () => {});
    await settle();
    stop();
    signal.wake();
    await settle();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.closed).toBe(true);
  });
});
