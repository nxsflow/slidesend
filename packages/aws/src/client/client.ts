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
export function awsClient(namespaces: { slidesend: unknown }): PlatformClient {
  const api = namespaces.slidesend as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const statusHandlers = new Set<(connected: boolean) => void>();
  let connected = true;
  const setStatus = (next: boolean) => {
    if (next === connected) return;
    connected = next;
    for (const handler of statusHandlers) handler(next);
  };

  return {
    async call(method, args) {
      const fn = api[method];
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
          const descriptor = (await api.subscribe?.(channel, topic)) as BlocksChannel;
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
