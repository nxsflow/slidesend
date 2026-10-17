import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessOf, type ServerMethod } from "@slidesend/core/server";
import { describePlatformConformance } from "@slidesend/core/testing";
import { describe, expect, it } from "vitest";

// The Blocks mocks keep their data under `.bb-data` in the working directory.
process.chdir(mkdtempSync(join(tmpdir(), "slidesend-aws-")));

const config = { meta: { title: "t", language: "en", plannedMinutes: 20 }, plannedMinutes: 20 };
const roundTrip = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

async function backend() {
  const { Scope } = await import("@aws-blocks/blocks");
  const { createAwsBackend } = await import("./backend");
  return createAwsBackend(
    new Scope(`sd-${Math.random().toString(36).slice(2, 8)}`),
    config as never,
  );
}

describePlatformConformance("AWS Blocks local mocks", async () => {
  const created = await backend();
  const { realtimeChannel, realtimeNamespace } = await import("./platform");
  const realtime = created.realtime as unknown as {
    subscribe(namespace: string, channel: string, handler: (data: unknown) => void): () => void;
  };
  return {
    server: created.platform,
    secret: { name: "control", value: (await created.blocks.secrets.control?.get()) ?? "" },
    connect: (api) => ({
      client: {
        async call(method, args) {
          const handler = Object.hasOwn(api, method) ? api[method] : undefined;
          if (!handler) throw new Error(`Unknown method "${method}".`);
          return roundTrip(await handler(...(roundTrip(args) as unknown[])));
        },
        subscribe: (channel, topic, handler) =>
          realtime.subscribe(realtimeNamespace, realtimeChannel(channel, topic), (data) =>
            handler(roundTrip(data)),
          ),
        onStatus: () => () => {},
      },
    }),
  };
});

describe("createAwsBackend", () => {
  it("classifies every method, and adds only an open subscribe to core's API", async () => {
    const { methods } = await backend();
    const access = accessOf(methods);
    expect(access.subscribe).toBe("open");
    expect(Object.values(access).every((value) => value !== undefined)).toBe(true);
    expect(Object.keys(access)).toContain("cursorGoto");
  });

  it("sends core's refusals to the client with their name, which AWS Blocks would hide", async () => {
    const { isWireSafeError } = await import("@aws-blocks/blocks");
    const { api, methods } = await backend();
    const guarded = Object.entries(accessOf(methods)).find(([, access]) => access === "session");
    const served = (api as unknown as (context: unknown) => Record<string, ServerMethod>)({});
    const refusal = await Promise.resolve(served[guarded?.[0] ?? ""]?.("no-such-session")).catch(
      (e: unknown) => e,
    );
    expect(isWireSafeError(refusal)).toBe(true);
    expect(refusal).toMatchObject({ name: "SessionClosedError", status: 409 });
  });

  it("runs core's sessions on the Blocks table", async () => {
    const { server } = await backend();
    const session = await server.sessions.create({ kind: "rehearsal", name: "Blocks" });
    expect((await server.sessions.open(session.id)).state).toBe("open");
    expect((await server.sessions.list()).map((s) => s.id)).toEqual([session.id]);
  });
});
