import { type PlatformClient, PlatformDisconnectedError } from "@slidesend/core";

/** A live subscription, as the Blocks client middleware hands it out. */
interface BlocksChannel {
  subscribe(options: { onMessage(message: unknown): void; onDisconnect?(reason: string): void }): {
    unsubscribe(): void;
    established?: Promise<void>;
  };
}

/** The generated client of the `slidesend` API namespace from the project's `aws-blocks`. */
export type SlidesendNamespace = Record<string, (...args: never[]) => Promise<unknown>>;

/**
 * The browser's `PlatformClient` on AWS (spec §8): calls go through the typed client that AWS
 * Blocks generates, subscriptions through the Realtime channels the backend hands out.
 *
 * ```ts
 * // src/main.tsx
 * import { slidesend } from "aws-blocks";
 * mount(presentation, { platform: awsClient({ slidesend }) });
 * ```
 */
export function awsClient(namespaces: {
  slidesend: unknown;
  /** Further namespaces a plugin's server half exports, e.g. `agentChat` (spec §4.1). */
  [name: string]: unknown;
}): PlatformClient {
  type Namespace = Record<string, (...args: unknown[]) => Promise<unknown>>;
  const api = namespaces.slidesend as Namespace;
  /** `"agentChat.send"` is the method `send` of the namespace `agentChat`; a bare name is core's. */
  const resolve = (method: string): ((...args: unknown[]) => Promise<unknown>) | undefined => {
    const dot = method.indexOf(".");
    if (dot < 0) return api[method];
    const namespace = namespaces[method.slice(0, dot)] as Namespace | undefined;
    return namespace?.[method.slice(dot + 1)];
  };
  const statusHandlers = new Set<(connected: boolean) => void>();
  let connected = true;
  const setStatus = (next: boolean) => {
    if (next === connected) return;
    connected = next;
    for (const handler of statusHandlers) handler(next);
  };

  return {
    async call(method, args) {
      const fn = resolve(method);
      if (!fn) throw new Error(`Unknown method "${method}".`);
      try {
        const result = await fn(...args);
        setStatus(true);
        return result;
      } catch (error) {
        if (error instanceof TypeError) {
          setStatus(false);
          throw new PlatformDisconnectedError();
        }
        throw error;
      }
    },
    subscribe(channel, topic, handler) {
      let stopped = false;
      let subscription: { unsubscribe(): void } | undefined;
      let attempt = 0;
      const open = async () => {
        if (stopped) return;
        try {
          // A plugin's channel names its own namespace and method, e.g. `agentChat.channel`,
          // and the topic's segments are that method's arguments — so its first segment is the
          // session id, and the method keeps the same guard as every other one (spec §9).
          // Core's channels are plain names and go through `slidesend.subscribe`.
          const own = channel.includes(".") ? resolve(channel) : undefined;
          const descriptor = (
            own ? await own(...topic.split("/")) : await api.subscribe?.(channel, topic)
          ) as BlocksChannel;
          if (stopped) return;
          const created = descriptor.subscribe({
            onMessage: handler,
            onDisconnect(reason) {
              if (reason === "client" || stopped) return;
              setStatus(false);
              setTimeout(() => void open(), Math.min(8000, 500 * 2 ** attempt++));
            },
          });
          subscription = created;
          await created.established;
          attempt = 0;
          setStatus(true);
        } catch {
          setStatus(false);
          setTimeout(() => void open(), Math.min(8000, 500 * 2 ** attempt++));
        }
      };
      void open();
      return () => {
        stopped = true;
        subscription?.unsubscribe();
      };
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
  };
}
