import { describe, expect, it } from "vitest";
import { z } from "zod";
import { StoreConditionError } from "../index";
import { createMemoryPlatform, describePlatformConformance } from "../testing";

describePlatformConformance("in-memory", () => {
  const platform = createMemoryPlatform({ secrets: { control: "s3cret" } });
  return {
    server: platform.server,
    connect: (api) => platform.connect(api),
    secret: { name: "control", value: "s3cret" },
  };
});

describe("in-memory platform", () => {
  const value = z.object({ n: z.number() });

  it("has a clock that only moves when told to", () => {
    const { server, clock } = createMemoryPlatform({ now: 1_000 });
    expect(server.now()).toBe(1_000);
    clock.advance(500);
    expect(server.now()).toBe(1_500);
    clock.set(10);
    expect(server.now()).toBe(10);
  });

  it("expires values by its own clock", async () => {
    const { server, clock } = createMemoryPlatform({ now: 0 });
    const store = server.store("s", value);
    await store.put("p/k", { n: 1 }, { expiresAt: 1_000 });
    clock.advance(999);
    expect(await store.get("p/k")).toEqual({ n: 1 });
    clock.advance(1);
    expect(await store.get("p/k")).toBeUndefined();
  });

  it("lets conditions see an expired value, as hosted stores do", async () => {
    const { server, clock } = createMemoryPlatform({ now: 0 });
    const store = server.store("s", value);
    await store.put("p/k", { n: 1 }, { expiresAt: 1 });
    clock.advance(10);
    await expect(store.put("p/k", { n: 2 }, { ifAbsent: true })).rejects.toBeInstanceOf(
      StoreConditionError,
    );
  });

  it("shares data between stores of the same name", async () => {
    const { server } = createMemoryPlatform();
    await server.store("s", value).put("p/k", { n: 1 });
    expect(await server.store("s", value).get("p/k")).toEqual({ n: 1 });
  });

  it("delivers messages asynchronously, after settle", async () => {
    const platform = createMemoryPlatform();
    const { client } = platform.connect({});
    const received: unknown[] = [];
    client.subscribe("c", "t", (message) => received.push(message));
    await platform.server.channel("c", z.string()).publish("t", "hi");
    expect(received).toEqual([]);
    await platform.settle();
    expect(received).toEqual(["hi"]);
  });

  it("drops a message whose subscriber disconnects before delivery", async () => {
    const platform = createMemoryPlatform();
    const connection = platform.connect({});
    const received: unknown[] = [];
    connection.client.subscribe("c", "t", (message) => received.push(message));
    await platform.server.channel("c", z.string()).publish("t", "in flight");
    connection.setConnected(false);
    await platform.settle();
    expect(received).toEqual([]);
  });
});
