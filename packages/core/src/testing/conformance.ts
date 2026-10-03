import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type PlatformClient,
  PlatformDisconnectedError,
  type PlatformServer,
  StoreConditionError,
} from "../platform/contract";
import type { ServerApi } from "../server/api";

/** One client connected through a harness. */
export interface HarnessConnection {
  client: PlatformClient;
  /** Simulates losing and regaining the network; the disconnect tests are skipped without it. */
  setConnected?(connected: boolean): void;
}

/** What the conformance suite needs from a platform implementation. */
export interface PlatformHarness {
  server: PlatformServer;
  /**
   * Connects a client that can call the methods of `api`. A hosted platform must expose exactly
   * these methods; the suite passes the same `conformanceApi` every time.
   */
  connect(api: ServerApi): HarnessConnection | Promise<HarnessConnection>;
  /** A secret the server can read. */
  secret: { name: string; value: string };
  /** How long to wait for a message to arrive, in ms. Defaults to 2000. */
  timeoutMs?: number;
}

/** The server methods the suite calls; a hosted harness deploys exactly these. */
export const conformanceApi: ServerApi = {
  echo: (value: unknown) => value,
  fail: () => {
    throw new Error("Deliberate failure.");
  },
};

const value = z.object({ n: z.number(), label: z.string().optional() });
const note = z.object({ text: z.string() });

/** A fresh partition per test, so that runs against a shared hosted store do not collide. */
const partition = () => `conformance-${Math.random().toString(36).slice(2, 10)}`;

async function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) throw new Error(`Timed out after ${timeoutMs} ms.`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Waits long enough that a message which was going to arrive would have arrived. */
const quiet = (timeoutMs: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 200)));

/**
 * Registers the conformance suite of the platform contract (spec §8) with Vitest. Every
 * platform implementation must pass it; `@slidesend/core/testing` runs it against the in-memory
 * platform, and a hosting package runs it against its own.
 */
export function describePlatformConformance(
  name: string,
  setup: () => PlatformHarness | Promise<PlatformHarness>,
): void {
  describe(`platform conformance: ${name}`, () => {
    let harness: PlatformHarness;
    let timeoutMs = 2000;
    beforeAll(async () => {
      harness = await setup();
      timeoutMs = harness.timeoutMs ?? timeoutMs;
    });

    describe("store", () => {
      it("stores, reads and deletes a value", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/one`;
        expect(await store.get(key)).toBeUndefined();
        await store.put(key, { n: 1 });
        expect(await store.get(key)).toEqual({ n: 1 });
        await store.delete(key);
        expect(await store.get(key)).toBeUndefined();
        await store.delete(key);
      });

      it("hands out copies, not the stored value", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/copy`;
        const original = { n: 1 };
        await store.put(key, original);
        original.n = 2;
        const read = await store.get(key);
        if (read) read.n = 3;
        expect(await store.get(key)).toEqual({ n: 1 });
      });

      it("rejects a value that does not pass the schema, and one that is too large", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/bad`;
        await expect(store.put(key, { n: "one" } as never)).rejects.toThrow();
        await expect(store.put(key, { n: 1, label: "x".repeat(400_000) })).rejects.toThrow(
          /larger than/,
        );
        expect(await store.get(key)).toBeUndefined();
      });

      it("rejects keys without a partition and a rest", async () => {
        const store = harness.server.store("conformance-a", value);
        for (const key of ["plain", "/rest", "partition/"]) {
          await expect(store.put(key, { n: 1 })).rejects.toThrow(/<partition>\/<rest>/);
          await expect(store.get(key)).rejects.toThrow(/<partition>\/<rest>/);
          await expect(store.delete(key)).rejects.toThrow(/<partition>\/<rest>/);
        }
      });

      it("writes with ifAbsent only once", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/once`;
        await store.put(key, { n: 1 }, { ifAbsent: true });
        await expect(store.put(key, { n: 2 }, { ifAbsent: true })).rejects.toBeInstanceOf(
          StoreConditionError,
        );
        expect(await store.get(key)).toEqual({ n: 1 });
      });

      it("writes with ifMatches only over a matching value", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/swap`;
        await expect(store.put(key, { n: 2 }, { ifMatches: { n: 1 } })).rejects.toBeInstanceOf(
          StoreConditionError,
        );
        await store.put(key, { n: 1, label: "a" });
        await store.put(key, { n: 2 }, { ifMatches: { n: 1 } });
        await expect(store.put(key, { n: 3 }, { ifMatches: { n: 1 } })).rejects.toBeInstanceOf(
          StoreConditionError,
        );
        expect(await store.get(key)).toEqual({ n: 2 });
      });

      it("deletes with ifMatches only a matching value", async () => {
        const store = harness.server.store("conformance-a", value);
        const key = `${partition()}/gone`;
        await store.put(key, { n: 1 });
        await expect(store.delete(key, { ifMatches: { n: 2 } })).rejects.toBeInstanceOf(
          StoreConditionError,
        );
        expect(await store.get(key)).toEqual({ n: 1 });
        await store.delete(key, { ifMatches: { n: 1 } });
        expect(await store.get(key)).toBeUndefined();
      });

      it("lists one partition by prefix, ordered, with limit and descending order", async () => {
        const store = harness.server.store("conformance-a", value);
        const own = partition();
        const other = partition();
        await store.put(`${own}/r/b`, { n: 2 });
        await store.put(`${own}/r/a`, { n: 1 });
        await store.put(`${own}/r/c`, { n: 3 });
        await store.put(`${own}/s/a`, { n: 9 });
        await store.put(`${other}/r/a`, { n: 8 });
        const keys = async (prefix: string, options?: Parameters<typeof store.list>[1]) =>
          (await store.list(prefix, options)).map((entry) => entry.key);
        expect(await keys(`${own}/r/`)).toEqual([`${own}/r/a`, `${own}/r/b`, `${own}/r/c`]);
        expect(await keys(`${own}/`)).toHaveLength(4);
        expect(await keys(`${own}/r/`, { order: "desc", limit: 2 })).toEqual([
          `${own}/r/c`,
          `${own}/r/b`,
        ]);
        expect((await store.list(`${own}/r/a`))[0]?.value).toEqual({ n: 1 });
      });

      it("refuses to list without a full partition", async () => {
        const store = harness.server.store("conformance-a", value);
        await expect(store.list("conformance")).rejects.toThrow(/full partition/);
        await expect(store.list("")).rejects.toThrow(/full partition/);
      });

      it("keeps stores apart", async () => {
        const a = harness.server.store("conformance-a", value);
        const b = harness.server.store("conformance-b", value);
        const key = `${partition()}/shared`;
        await a.put(key, { n: 1 });
        expect(await b.get(key)).toBeUndefined();
        expect(await b.list(`${key.split("/")[0]}/`)).toEqual([]);
      });

      it("hides expired values from get and list", async () => {
        const store = harness.server.store("conformance-a", value);
        const own = partition();
        await store.put(`${own}/old`, { n: 1 }, { expiresAt: harness.server.now() - 1000 });
        await store.put(`${own}/new`, { n: 2 }, { expiresAt: harness.server.now() + 60_000 });
        expect(await store.get(`${own}/old`)).toBeUndefined();
        expect((await store.list(`${own}/`)).map((entry) => entry.key)).toEqual([`${own}/new`]);
      });
    });

    describe("secrets", () => {
      it("reads a secret, and rejects one that is not set", async () => {
        expect(await harness.server.secret(harness.secret.name)).toBe(harness.secret.value);
        await expect(harness.server.secret(`${harness.secret.name}-missing`)).rejects.toThrow();
      });
    });

    describe("calls", () => {
      it("round-trips JSON arguments and results", async () => {
        const { client } = await harness.connect(conformanceApi);
        const at = new Date(Date.UTC(2026, 0, 1));
        expect(await client.call("echo", [{ at, list: [1, "two"] }])).toEqual({
          at: at.toISOString(),
          list: [1, "two"],
        });
      });

      it("rejects with the server's message, and for unknown methods", async () => {
        const { client } = await harness.connect(conformanceApi);
        await expect(client.call("fail", [])).rejects.toThrow("Deliberate failure.");
        await expect(client.call("missing", [])).rejects.toThrow();
      });
    });

    describe("channels", () => {
      it("delivers to subscribers of the same channel and topic only", async () => {
        const { client } = await harness.connect(conformanceApi);
        const channel = harness.server.channel("conformance", note);
        const other = harness.server.channel("conformance-other", note);
        const topic = partition();
        const received: unknown[] = [];
        const stop = client.subscribe("conformance", topic, (message) => received.push(message));
        await other.publish(topic, { text: "other channel" });
        await channel.publish(`${topic}-other`, { text: "other topic" });
        await channel.publish(topic, { text: "hello" });
        await waitFor(() => received.length > 0, timeoutMs);
        await quiet(timeoutMs);
        expect(received).toEqual([{ text: "hello" }]);
        stop();
        await channel.publish(topic, { text: "after unsubscribe" });
        await quiet(timeoutMs);
        expect(received).toEqual([{ text: "hello" }]);
      });

      it("rejects a message that does not pass the schema", async () => {
        const channel = harness.server.channel("conformance", note);
        await expect(channel.publish(partition(), { text: 1 } as never)).rejects.toThrow();
      });
    });

    describe("disconnects", () => {
      it("rejects calls, loses messages and reports status while disconnected", async (context) => {
        const connection = await harness.connect(conformanceApi);
        const { client, setConnected } = connection;
        if (!setConnected) return context.skip();
        const channel = harness.server.channel("conformance", note);
        const topic = partition();
        const received: unknown[] = [];
        const status: boolean[] = [];
        client.onStatus((connected) => status.push(connected));
        client.subscribe("conformance", topic, (message) => received.push(message));

        setConnected(false);
        await expect(client.call("echo", [1])).rejects.toBeInstanceOf(PlatformDisconnectedError);
        await channel.publish(topic, { text: "lost" });
        await quiet(timeoutMs);

        setConnected(true);
        await channel.publish(topic, { text: "back" });
        await waitFor(() => received.length > 0, timeoutMs);
        expect(received).toEqual([{ text: "back" }]);
        expect(status).toEqual([false, true]);
        expect(await client.call("echo", [1])).toBe(1);
      });
    });
  });
}
