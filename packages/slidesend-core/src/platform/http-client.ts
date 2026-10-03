import { type PlatformClient, PlatformDisconnectedError } from "./contract";

/** Options of `httpPlatformClient`. */
export interface HttpPlatformClientOptions {
  /** Where the bridge listens; defaults to `/__slidesend` on the page's own origin. */
  baseUrl?: string;
}

/**
 * A `PlatformClient` over plain HTTP: calls are POST requests, subscriptions are Server-Sent
 * Events. It talks to the dev bridge (`slidesendDev`), which serves core's server on the
 * in-memory platform, so a talk runs with sessions and phones on the local network, without
 * any cloud account.
 */
export function httpPlatformClient(options: HttpPlatformClientOptions = {}): PlatformClient {
  const base = options.baseUrl ?? "/__slidesend";
  const statusHandlers = new Set<(connected: boolean) => void>();
  let connected = true;
  const setStatus = (next: boolean) => {
    if (next === connected) return;
    connected = next;
    for (const handler of statusHandlers) handler(next);
  };

  return {
    async call(method, args) {
      let response: Response;
      try {
        response = await fetch(`${base}/call`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method, args }),
        });
      } catch {
        setStatus(false);
        throw new PlatformDisconnectedError();
      }
      setStatus(true);
      const body = (await response.json()) as
        | { ok: true; result: unknown }
        | { ok: false; error: { name: string; message: string } };
      if (body.ok) return body.result;
      const error = new Error(body.error.message);
      error.name = body.error.name;
      throw error;
    },
    subscribe(channel, topic, handler) {
      const url = `${base}/events?${new URLSearchParams({ channel, topic })}`;
      let source: EventSource | undefined;
      let stopped = false;
      let attempt = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // A browser gives an event stream up for good when reconnecting fails, e.g. while offline;
      // this reopens it after a pause, and at once when the network returns.
      const open = () => {
        if (stopped) return;
        clearTimeout(timer);
        source?.close();
        source = new EventSource(url);
        source.onmessage = (event) => handler(JSON.parse(event.data));
        source.onopen = () => {
          attempt = 0;
          setStatus(true);
        };
        source.onerror = () => {
          setStatus(false);
          if (source?.readyState === EventSource.CLOSED) {
            timer = setTimeout(open, Math.min(8000, 1000 * 2 ** attempt++));
          }
        };
      };
      const onOnline = () => {
        if (source?.readyState !== EventSource.OPEN) open();
      };
      window.addEventListener("online", onOnline);
      open();
      return () => {
        stopped = true;
        clearTimeout(timer);
        window.removeEventListener("online", onOnline);
        source?.close();
      };
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
  };
}
