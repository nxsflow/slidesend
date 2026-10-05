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

  // All subscriptions of the page share ONE event stream. A browser allows only six HTTP/1.1
  // connections per host, and an event stream holds one for good: with a stream per
  // subscription, desk, stage and phone in one browser use them up, and every later call waits
  // for a free one — the stage then stops following and never reports itself (GH #50).
  type Subscription = { channel: string; topic: string; handler: (message: unknown) => void };
  const subscriptions = new Set<Subscription>();
  /** The stream that delivers, and a replacement for it that is still opening. */
  let source: EventSource | undefined;
  let pending: EventSource | undefined;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;

  const deliver = (data: string) => {
    const { channel, topic, message } = JSON.parse(data) as {
      channel: string;
      topic: string;
      message: unknown;
    };
    for (const subscription of [...subscriptions]) {
      if (subscription.channel === channel && subscription.topic === topic) {
        subscription.handler(message);
      }
    }
  };

  /**
   * Opens a stream for the current subscriptions. The old stream keeps delivering until its
   * replacement is open, so changing the subscriptions loses no message on the others.
   */
  const open = () => {
    clearTimeout(retry);
    pending?.close();
    pending = undefined;
    if (subscriptions.size === 0) {
      source?.close();
      source = undefined;
      return;
    }
    const pairs = [...new Set([...subscriptions].map((s) => JSON.stringify([s.channel, s.topic])))];
    const next = new EventSource(
      `${base}/events?${new URLSearchParams({ subscribe: `[${pairs.join(",")}]` })}`,
    );
    const replacing = source !== undefined && source.readyState !== EventSource.CLOSED;
    if (replacing) pending = next;
    else {
      source?.close();
      source = next;
    }
    next.onmessage = (event) => {
      if (source === next) deliver(event.data);
    };
    next.onopen = () => {
      if (pending === next) {
        source?.close();
        source = next;
        pending = undefined;
      }
      attempt = 0;
      setStatus(true);
    };
    next.onerror = () => {
      if (pending === next) {
        // The replacement failed; the old stream still delivers. Try again after a pause.
        next.close();
        pending = undefined;
        retry = setTimeout(open, Math.min(8000, 1000 * 2 ** attempt++));
        return;
      }
      if (source !== next) return;
      setStatus(false);
      if (next.readyState === EventSource.CLOSED) {
        retry = setTimeout(open, Math.min(8000, 1000 * 2 ** attempt++));
      }
    };
  };
  /** Several subscribe and unsubscribe calls in one task reopen the stream once. */
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      open();
    });
  };
  // A browser gives an event stream up for good when reconnecting fails, e.g. while offline;
  // this reopens it after a pause, and at once when the network returns.
  window.addEventListener("online", () => {
    if (source?.readyState !== EventSource.OPEN) open();
  });

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
      const subscription = { channel, topic, handler };
      subscriptions.add(subscription);
      schedule();
      return () => {
        subscriptions.delete(subscription);
        schedule();
      };
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
  };
}
