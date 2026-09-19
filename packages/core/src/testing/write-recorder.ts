import type { PlatformServer } from "../platform/contract";

/** A platform server that records every write, for tests that prove a refusal wrote nothing. */
export interface RecordedServer {
  server: PlatformServer;
  /** Every write so far, e.g. `put sessions sessions/s-1` or `publish cursor s-1`. */
  writes: string[];
}

/**
 * Wraps a platform server so that every store write and every channel publish is recorded.
 * Model calls will be recorded here too once platforms offer them.
 */
export function recordWrites(inner: PlatformServer): RecordedServer {
  const writes: string[] = [];
  const server: PlatformServer = {
    ...inner,
    store(name, schema) {
      const store = inner.store(name, schema);
      return {
        ...store,
        put: (key, value, options) => {
          writes.push(`put ${name} ${key}`);
          return store.put(key, value, options);
        },
        delete: (key, options) => {
          writes.push(`delete ${name} ${key}`);
          return store.delete(key, options);
        },
      };
    },
    channel(name, schema) {
      const channel = inner.channel(name, schema);
      return {
        publish: (topic, message) => {
          writes.push(`publish ${name} ${topic}`);
          return channel.publish(topic, message);
        },
      };
    },
  };
  return { server, writes };
}
