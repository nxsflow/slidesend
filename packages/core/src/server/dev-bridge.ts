import { createMemoryPlatform, type MemoryPlatform } from "../testing/memory-platform";
import { createServer } from "./runtime";
import { controlSecretName } from "./sessions";

/** Options of `createDevBridge` and `slidesendDev`. */
export interface DevBridgeOptions {
  /** A session's planned length unless given: the deck's planned minutes. */
  defaultPlannedMinutes: number;
  /** The control secret; a random one is made and printed if omitted. */
  secret?: string;
  /** Where the bridge listens; defaults to `/__slidesend`. */
  basePath?: string;
}

type Next = () => void;

/** Reads the `subscribe` parameter of an event stream: a JSON list of `[channel, topic]`. */
export function parseSubscriptions(value: string | null): [string, string][] | undefined {
  try {
    const parsed: unknown = JSON.parse(value ?? "");
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          typeof pair[0] === "string" &&
          typeof pair[1] === "string",
      )
    ) {
      return parsed as [string, string][];
    }
  } catch {
    // Falls through to undefined.
  }
  return undefined;
}

/** The parts of Node's request the bridge reads; typed here so core needs no Node types. */
interface IncomingMessage extends AsyncIterable<Uint8Array | string> {
  url?: string;
  method?: string;
  on(event: "close", listener: () => void): void;
}

/** The parts of Node's response the bridge writes. */
interface ServerResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  writeHead(status: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  end(chunk?: string): void;
}

/**
 * Serves core's server on the in-memory platform over HTTP, for development: POST
 * `<base>/call` with `{ method, args }`, and `GET <base>/events?subscribe=[[channel, topic], …]`
 * as Server-Sent Events, one stream for every subscription of a page, each message as
 * `{ channel, topic, message }`. `POST <base>/drop` closes every event stream, so tests can cut connections the way a
 * lost network does. Returns a connect-style middleware, the platform and the control secret.
 */
export function createDevBridge(
  options: DevBridgeOptions,
  /** A bridge this one replaces: its secret and its data carry over, unless the secret changed. */
  previous?: { secret: string; memory: MemoryPlatform; close(): void },
) {
  previous?.close();
  const carried = previous && (options.secret ?? previous.secret) === previous.secret;
  const secret =
    options.secret ??
    previous?.secret ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  const base = options.basePath ?? "/__slidesend";
  const memory: MemoryPlatform =
    carried && previous
      ? previous.memory
      : createMemoryPlatform({ secrets: { [controlSecretName]: secret } });
  // The in-memory clock only moves when told to; a dev server follows the real one.
  memory.clock.set(Date.now());
  const clockTimer = setInterval(() => memory.clock.set(Date.now()), 250);
  // Do not keep a Node process alive just for the clock.
  (clockTimer as unknown as { unref?(): void }).unref?.();
  const server = createServer({
    platform: memory.server,
    defaultPlannedMinutes: options.defaultPlannedMinutes,
  });
  const calls = memory.connect(server.api).client;
  /** Open event streams, so `drop` can cut them like a lost network would. */
  const streams = new Set<ServerResponse>();

  async function readBody(request: IncomingMessage): Promise<string> {
    const decoder = new TextDecoder();
    let text = "";
    for await (const chunk of request) {
      text += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    }
    return text + decoder.decode();
  }

  async function middleware(request: IncomingMessage, response: ServerResponse, next: Next) {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === `${base}/call` && request.method === "POST") {
      memory.clock.set(Date.now());
      const { method, args } = JSON.parse(await readBody(request)) as {
        method: string;
        args: unknown[];
      };
      let body: unknown;
      try {
        body = { ok: true, result: await calls.call(method, args) };
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        body = { ok: false, error: { name: failure.name, message: failure.message } };
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(body ?? null));
      return;
    }
    if (url.pathname === `${base}/drop` && request.method === "POST") {
      // For tests: closing every stream is what a network loss does to the clients.
      for (const stream of streams) stream.end();
      streams.clear();
      response.end("{}");
      return;
    }
    if (url.pathname === `${base}/events` && request.method === "GET") {
      const subscriptions = parseSubscriptions(url.searchParams.get("subscribe"));
      if (!subscriptions) {
        response.statusCode = 400;
        response.end("subscribe must be a JSON list of [channel, topic] pairs");
        return;
      }
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      // Ask the browser to reconnect after one second instead of its default of about three.
      response.write("retry: 1000\n: connected\n\n");
      const connection = memory.connect(server.api);
      const stops = subscriptions.map(([channel, topic]) =>
        connection.client.subscribe(channel, topic, (message) => {
          response.write(`data: ${JSON.stringify({ channel, topic, message })}\n\n`);
        }),
      );
      streams.add(response);
      request.on("close", () => {
        for (const stop of stops) stop();
        streams.delete(response);
      });
      return;
    }
    next();
  }

  return {
    middleware,
    secret,
    memory,
    server,
    close: () => clearInterval(clockTimer),
  };
}

/** A running dev bridge. */
export type DevBridge = ReturnType<typeof createDevBridge>;

/** Where the bridges of this process are kept across Vite's server restarts. */
const bridgesKey = Symbol.for("slidesend.dev-bridges");

function bridgesOfProcess(): Map<string, DevBridge> {
  const scope = globalThis as { [bridgesKey]?: Map<string, DevBridge> };
  if (!scope[bridgesKey]) scope[bridgesKey] = new Map();
  return scope[bridgesKey];
}

/** The part of a Vite dev server the plugin needs. */
interface ViteLikeServer {
  middlewares: {
    use(handler: (request: IncomingMessage, response: ServerResponse, next: Next) => void): void;
  };
  config?: { logger?: { info(message: string): void } };
  httpServer?: { on(event: "listening", listener: () => void): void; address(): unknown } | null;
  /** Where Vite listens, known once it does: `local` and, with `--host`, `network` addresses. */
  resolvedUrls?: { local: string[]; network: string[] } | null;
  /** Prints Vite's addresses; the CLI calls it once the server listens. */
  printUrls?(): void;
}

/** The desk links for the addresses Vite listens on: local first, then every network address. */
export function deskLinks(
  urls: { local: readonly string[]; network: readonly string[] },
  secret: string,
): string[] {
  const link = (base: string) => `${base.replace(/\/$/, "")}/desk#key=${secret}`;
  return [
    ...urls.local.slice(0, 1).map((base) => `  Slidesend desk: ${link(base)}`),
    ...urls.network.map((base) => `  Slidesend desk for phones on this network: ${link(base)}`),
  ];
}

/**
 * A Vite plugin that serves the dev bridge from the Vite dev server and prints the desk link
 * with the control secret in the address fragment (spec §11). Use it together with
 * `httpPlatformClient()` in the browser.
 */
export function slidesendDev(options: DevBridgeOptions) {
  return {
    name: "slidesend-dev",
    apply: "serve" as const,
    configureServer(vite: ViteLikeServer) {
      // Vite restarts its server in the same process when its config changes. The bridge
      // carries over, so the printed desk link, control and the running sessions survive it.
      const bridges = bridgesOfProcess();
      const basePath = options.basePath ?? "/__slidesend";
      const bridge = createDevBridge(options, bridges.get(basePath));
      bridges.set(basePath, bridge);
      vite.middlewares.use((request, response, next) => {
        bridge.middleware(request, response, next).catch((error: unknown) => {
          response.statusCode = 500;
          response.end(String(error));
        });
      });
      const log = (line: string) => (vite.config?.logger ?? console).info(line);
      const printUrls = vite.printUrls?.bind(vite);
      if (printUrls) {
        // Right after Vite's own addresses, when it knows them — including the network address
        // that phones need, so nobody has to put the desk link together by hand.
        vite.printUrls = () => {
          printUrls();
          for (const line of deskLinks(
            vite.resolvedUrls ?? { local: [], network: [] },
            bridge.secret,
          )) {
            log(line);
          }
        };
        return;
      }
      vite.httpServer?.on("listening", () => {
        const address = vite.httpServer?.address() as { port?: number } | null;
        const link = `http://localhost:${address?.port ?? 5173}/desk#key=${bridge.secret}`;
        log(`  Slidesend desk: ${link}`);
      });
    },
  };
}
