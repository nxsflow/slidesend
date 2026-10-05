import { typedClient } from "../client/client";
import type { PlatformClient } from "../platform/contract";
import type { CoreApi } from "../server/runtime";
import { type Cursor, type CursorTarget, channels } from "../sessions/runtime-types";

/** How the views of one session stay in step (spec §11). */
export interface CursorTransport {
  /** `local`: one browser, BroadcastChannel, no audience. `hosted`: the platform. */
  readonly kind: "local" | "hosted";
  /** This window's id; its own moves carry it as `from`. */
  readonly id: string;
  /** Sends a move. Rapid moves are combined; only the last one within 120 ms is sent. */
  send(target: CursorTarget): void;
  /** Receives the cursor whenever it changes elsewhere, and after every catch-up. */
  onCursor(handler: (cursor: Cursor) => void): () => void;
  /** Reports whether the transport is connected. */
  onStatus(handler: (connected: boolean) => void): () => void;
  /** Fetches the current cursor now. */
  refresh(): Promise<void>;
  close(): void;
}

/** The browser signals a transport listens to; injectable so tests can drive them. */
export interface SyncEnvironment {
  /** Calls `handler` when the page becomes visible, comes back online or is shown again. */
  onWake(handler: () => void): () => void;
  isVisible(): boolean;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

/** The environment of a real browser page. */
export function browserEnvironment(): SyncEnvironment {
  return {
    onWake(handler) {
      const onVisibility = () => {
        if (document.visibilityState === "visible") handler();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("online", handler);
      window.addEventListener("pageshow", handler);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("online", handler);
        window.removeEventListener("pageshow", handler);
      };
    },
    isVisible: () => document.visibilityState === "visible",
    setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
    clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  };
}

/** Moves within this window are combined for this long before one is sent. */
export const sendDebounceMs = 120;
/** The slow pulse that catches a silently dead connection (spec §11). */
export const pulseMs = 20_000;
/**
 * Extra reads of the cursor after every connect, in ms. A subscription can take a moment to
 * become visible to the server's fan-out — AWS Blocks finds subscribers through an eventually
 * consistent index — and a move published in that moment never reaches the new subscriber. The
 * read on connect happens before the move; these reads happen after it.
 */
export const settleReadsMs = [1_500, 5_000] as const;

/** Reconnect backoff: 500 ms, doubling, capped at 8 s. */
export const backoffMs = (attempt: number) => Math.min(8000, 500 * 2 ** attempt);

const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/**
 * Keeps the newest cursor only: a fetched cursor that is older than one already applied, e.g.
 * because a message overtook the fetch, is ignored.
 */
function newestOnly(handlers: Set<(cursor: Cursor) => void>) {
  let latest: Cursor | undefined;
  return {
    get latest() {
      return latest;
    },
    apply(cursor: Cursor | undefined) {
      if (!cursor || (latest && cursor.at < latest.at)) return;
      latest = cursor;
      for (const handler of handlers) handler(cursor);
    },
  };
}

type LocalMessage =
  | { type: "cursor"; cursor: Cursor }
  /** A window that just opened asks the others for the current cursor. */
  | { type: "hello"; from: string };

/** Options of `localTransport`. */
export interface LocalTransportOptions {
  sessionId: string;
  /** Creates the channel; defaults to the global `BroadcastChannel`. */
  createChannel?: (name: string) => BroadcastChannel;
  environment?: SyncEnvironment;
  now?: () => number;
}

/**
 * The transport of local mode (spec §4.1): stage and desk in one browser, coupled by a
 * BroadcastChannel per session, no backend and no audience. A window that opens asks the others
 * for the current cursor.
 */
export function localTransport(options: LocalTransportOptions): CursorTransport {
  const id = randomId();
  const environment = options.environment ?? browserEnvironment();
  const now = options.now ?? (() => Date.now());
  const channel = (options.createChannel ?? ((name) => new BroadcastChannel(name)))(
    `slidesend:${options.sessionId}`,
  );
  const handlers = new Set<(cursor: Cursor) => void>();
  const cursor = newestOnly(handlers);
  let timer: unknown;
  let queued: CursorTarget | undefined;

  const onMessage = (event: MessageEvent<LocalMessage>) => {
    const message = event.data;
    if (message?.type === "cursor" && message.cursor.from !== id) cursor.apply(message.cursor);
    if (message?.type === "hello" && message.from !== id && cursor.latest) {
      channel.postMessage({ type: "cursor", cursor: cursor.latest } satisfies LocalMessage);
    }
  };
  channel.addEventListener("message", onMessage as EventListener);
  const post = (message: LocalMessage) => channel.postMessage(message);
  post({ type: "hello", from: id });

  return {
    kind: "local",
    id,
    send(target) {
      queued = target;
      environment.clearTimeout(timer);
      timer = environment.setTimeout(() => {
        if (!queued) return;
        const next: Cursor = { ...queued, at: now(), from: id };
        queued = undefined;
        cursor.apply(next);
        post({ type: "cursor", cursor: next });
      }, sendDebounceMs);
    },
    onCursor(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onStatus(handler) {
      // A BroadcastChannel cannot break.
      handler(true);
      return () => {};
    },
    async refresh() {
      post({ type: "hello", from: id });
    },
    close() {
      environment.clearTimeout(timer);
      channel.removeEventListener("message", onMessage as EventListener);
      channel.close();
    },
  };
}

/** Options of `hostedTransport`. */
export interface HostedTransportOptions {
  platform: PlatformClient;
  sessionId: string;
  /** The control secret; with it the window reads with control and may send moves. */
  secret?: string;
  environment?: SyncEnvironment;
}

/**
 * The transport over the hosted platform (spec §11). It subscribes to the session's cursor topic
 * and fetches the current cursor after every connect, when the page wakes up (visible again,
 * online, shown from the back-forward cache) and on a slow pulse, so a locked phone returns to
 * the right slide by itself. After every connect it reads twice more (`settleReadsMs`), for a
 * move published before the new subscription reached the server's fan-out. Failed fetches retry
 * with backoff.
 */
export function hostedTransport(options: HostedTransportOptions): CursorTransport {
  const { platform, sessionId, secret } = options;
  const id = randomId();
  const environment = options.environment ?? browserEnvironment();
  const api = typedClient<CoreApi>(platform);
  const handlers = new Set<(cursor: Cursor) => void>();
  const statusHandlers = new Set<(connected: boolean) => void>();
  const cursor = newestOnly(handlers);
  let connected = false;
  let closed = false;
  let attempt = 0;
  let retry: unknown;
  let sendTimer: unknown;
  let settleTimers: unknown[] = [];
  let queued: CursorTarget | undefined;
  /** Moves of this window sent but not yet answered. */
  let inFlight = 0;

  const setStatus = (next: boolean) => {
    if (next === connected) return;
    connected = next;
    for (const handler of statusHandlers) handler(next);
  };

  async function refresh(): Promise<void> {
    if (closed) return;
    try {
      const current = secret
        ? await api.cursorRead(secret, sessionId)
        : await api.cursorGet(sessionId);
      if (closed) return;
      attempt = 0;
      setStatus(true);
      // While this window's own move waits or travels, a read returns the cursor before it;
      // applying that would pull this window back a step. The move's answer brings the cursor.
      if (queued || inFlight > 0) return;
      cursor.apply(current ?? undefined);
    } catch {
      if (closed) return;
      setStatus(false);
      environment.clearTimeout(retry);
      retry = environment.setTimeout(() => void refresh(), backoffMs(attempt++));
    }
  }

  /** Reads now, and again while a fresh subscription may still be missing from the fan-out. */
  function connect(): void {
    for (const timer of settleTimers) environment.clearTimeout(timer);
    settleTimers = settleReadsMs.map((ms) => environment.setTimeout(() => void refresh(), ms));
    void refresh();
  }

  const stopMessages = platform.subscribe(channels.cursor, sessionId, (message) => {
    const next = message as Cursor;
    if (next.from !== id) cursor.apply(next);
  });
  const stopStatus = platform.onStatus((up) => {
    if (up) connect();
    else setStatus(false);
  });
  const stopWake = environment.onWake(() => {
    attempt = 0;
    void refresh();
  });
  const pulse = environment.setInterval(() => {
    if (environment.isVisible()) void refresh();
  }, pulseMs);
  connect();

  return {
    kind: "hosted",
    id,
    send(target) {
      if (!secret) return;
      queued = target;
      environment.clearTimeout(sendTimer);
      sendTimer = environment.setTimeout(() => {
        const next = queued;
        queued = undefined;
        if (!next || closed) return;
        inFlight++;
        api
          .cursorGoto(secret, sessionId, next, id)
          .then(
            (saved) => cursor.apply(saved),
            () => setStatus(false),
          )
          .finally(() => {
            inFlight--;
          });
      }, sendDebounceMs);
    },
    onCursor(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      handler(connected);
      return () => statusHandlers.delete(handler);
    },
    refresh,
    close() {
      closed = true;
      environment.clearTimeout(retry);
      environment.clearTimeout(sendTimer);
      for (const timer of settleTimers) environment.clearTimeout(timer);
      environment.clearInterval(pulse);
      stopMessages();
      stopStatus();
      stopWake();
    },
  };
}
