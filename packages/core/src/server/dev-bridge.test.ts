import { describe, expect, it } from "vitest";
import { createDevBridge, deskLinks, parseSubscriptions, slidesendDev } from "./dev-bridge";

describe("the dev bridge's desk links", () => {
  it("prints one for this machine and one for each network address", () => {
    expect(
      deskLinks(
        { local: ["http://localhost:5173/"], network: ["http://192.168.1.20:5173/"] },
        "s3cret",
      ),
    ).toEqual([
      "  Slidesend desk: http://localhost:5173/desk#key=s3cret",
      "  Slidesend desk for phones on this network: http://192.168.1.20:5173/desk#key=s3cret",
    ]);
  });

  it("follows Vite's own address lines, once Vite knows its addresses", () => {
    const lines: string[] = [];
    const vite = {
      middlewares: { use: () => {} },
      config: { logger: { info: (line: string) => lines.push(line) } },
      resolvedUrls: { local: ["http://localhost:5174/"], network: ["http://10.0.0.5:5174/"] },
      printUrls: () => lines.push("vite urls"),
    };
    slidesendDev({ defaultPlannedMinutes: 10, secret: "k" }).configureServer(vite);
    vite.printUrls();
    expect(lines).toEqual([
      "vite urls",
      "  Slidesend desk: http://localhost:5174/desk#key=k",
      "  Slidesend desk for phones on this network: http://10.0.0.5:5174/desk#key=k",
    ]);
  });
});

describe("the dev bridge's event stream", () => {
  it("takes every subscription of a page as one list of channel and topic", () => {
    expect(parseSubscriptions('[["cursor","s-1"],["responses","s-1/mood"]]')).toEqual([
      ["cursor", "s-1"],
      ["responses", "s-1/mood"],
    ]);
  });

  it("refuses anything else", () => {
    for (const value of [null, "", "cursor", '{"cursor":"s-1"}', '[["cursor"]]', "[[1,2]]"]) {
      expect(parseSubscriptions(value)).toBeUndefined();
    }
  });
});

describe("a dev bridge that replaces another", () => {
  const call = async (
    bridge: ReturnType<typeof createDevBridge>,
    method: string,
    args: unknown[],
  ) => {
    let body = "";
    const request = {
      url: "/__slidesend/call",
      method: "POST",
      on: () => {},
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ method, args });
      },
    };
    const response = {
      statusCode: 200,
      setHeader: () => {},
      writeHead: () => {},
      write: () => {},
      end: (chunk?: string) => {
        body = chunk ?? "";
      },
    };
    await bridge.middleware(request, response, () => {});
    return JSON.parse(body) as { ok: boolean; result?: unknown };
  };

  it("keeps the secret and the sessions, as across a restart of Vite's server", async () => {
    const first = createDevBridge({ defaultPlannedMinutes: 10 });
    await call(first, "sessionCreate", [first.secret, { kind: "rehearsal", name: "Before" }]);
    const second = createDevBridge({ defaultPlannedMinutes: 10 }, first);
    expect(second.secret).toBe(first.secret);
    const list = await call(second, "sessionList", [second.secret]);
    expect(list.result).toEqual([expect.objectContaining({ name: "Before" })]);
    second.close();
  });

  it("starts afresh when it is given another secret", async () => {
    const first = createDevBridge({ defaultPlannedMinutes: 10, secret: "one" });
    await call(first, "sessionCreate", ["one", { kind: "rehearsal", name: "Before" }]);
    const second = createDevBridge({ defaultPlannedMinutes: 10, secret: "two" }, first);
    expect((await call(second, "sessionList", ["two"])).result).toEqual([]);
    expect((await call(second, "sessionList", ["one"])).ok).toBe(false);
    second.close();
  });
});
