import type { ZodType } from "zod";
import {
  type Channel,
  type DeleteOptions,
  type ListOptions,
  maxValueBytes,
  type PlatformClient,
  PlatformDisconnectedError,
  type PlatformServer,
  type PutOptions,
  type Store,
  StoreConditionError,
  serializedBytes,
  splitListPrefix,
  splitStoreKey,
} from "../platform/contract";

/**
 * The server methods a client can call: each takes JSON-serializable arguments and returns a
 * JSON-serializable result, or a promise of one.
 */
// biome-ignore lint/suspicious/noExplicitAny: methods take arbitrary JSON arguments
export type ServerApi = Readonly<Record<string, (...args: any[]) => unknown>>;

/** Options of `createMemoryPlatform`. */
export interface MemoryPlatformOptions {
  /** Secrets the server can read. */
  secrets?: Readonly<Record<string, string>>;
  /** The clock's start time in epoch ms; defaults to 2026-01-01T00:00:00Z. */
  now?: number;
}

/** A clock that only moves when told to. */
export interface MemoryClock {
  now(): number;
  set(epochMs: number): void;
  advance(ms: number): void;
}

/** One client connected to the in-memory platform, with a switch to simulate network loss. */
export interface MemoryConnection {
  client: PlatformClient;
  readonly connected: boolean;
  /** Drops or restores the connection; status handlers are told, lost messages stay lost. */
  setConnected(connected: boolean): void;
}

/** The in-memory platform: the server half, a controllable clock, and clients to connect. */
export interface MemoryPlatform {
  server: PlatformServer;
  clock: MemoryClock;
  /** Connects a new client, e.g. a stage, a desk or a phone, that calls methods of `api`. */
  connect(api: ServerApi): MemoryConnection;
  /** Resolves once every message and status change in flight has been delivered. */
  settle(): Promise<void>;
}

interface Stored {
  json: string;
  expiresAt?: number;
}

interface Subscription {
  channel: string;
  topic: string;
  handler: (message: unknown) => void;
  connection: { connected: boolean };
}

const roundTrip = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function matches(stored: unknown, expected: object): boolean {
  if (typeof stored !== "object" || stored === null) return false;
  return Object.entries(expected).every(
    ([field, value]) =>
      JSON.stringify((stored as Record<string, unknown>)[field]) === JSON.stringify(value),
  );
}

/**
 * Creates an in-memory platform. It behaves like a hosted one where server logic depends on it:
 * values are stored serialized and validated, conditional writes, prefix listing and its order,
 * expiry, asynchronous delivery to subscribers, and messages lost while a client is
 * disconnected. Like hosted stores, conditions may still see an expired value until it is
 * removed, so do not combine `expiresAt` with `ifAbsent`.
 */
export function createMemoryPlatform(options: MemoryPlatformOptions = {}): MemoryPlatform {
  let now = options.now ?? Date.UTC(2026, 0, 1);
  const clock: MemoryClock = {
    now: () => now,
    set: (epochMs) => {
      now = epochMs;
    },
    advance: (ms) => {
      now += ms;
    },
  };

  /** store name → partition → rest of key → value */
  const data = new Map<string, Map<string, Map<string, Stored>>>();
  const subscriptions = new Set<Subscription>();

  const live = (entry: Stored | undefined) =>
    entry && (entry.expiresAt === undefined || entry.expiresAt > now) ? entry : undefined;

  function store<T>(name: string, schema: ZodType<T>): Store<T> {
    const partitions = data.get(name) ?? new Map<string, Map<string, Stored>>();
    data.set(name, partitions);
    const partitionOf = (partition: string) => {
      const entries = partitions.get(partition) ?? new Map<string, Stored>();
      partitions.set(partition, entries);
      return entries;
    };

    return {
      async get(key) {
        const { partition, rest } = splitStoreKey(key);
        const entry = live(partitions.get(partition)?.get(rest));
        return entry ? (JSON.parse(entry.json) as T) : undefined;
      },

      async put(key, value, options: PutOptions<T> = {}) {
        const { partition, rest } = splitStoreKey(key);
        const parsed = schema.parse(value);
        if (serializedBytes(parsed) > maxValueBytes) {
          throw new Error(`The value for "${key}" is larger than ${maxValueBytes} bytes.`);
        }
        const entries = partitionOf(partition);
        const existing = entries.get(rest);
        if (options.ifAbsent && existing) throw new StoreConditionError(key, "ifAbsent");
        if (
          options.ifMatches &&
          !(existing && matches(JSON.parse(existing.json), options.ifMatches))
        ) {
          throw new StoreConditionError(key, "ifMatches");
        }
        entries.set(rest, { json: JSON.stringify(parsed), expiresAt: options.expiresAt });
      },

      async delete(key, options: DeleteOptions<T> = {}) {
        const { partition, rest } = splitStoreKey(key);
        const entries = partitions.get(partition);
        const existing = entries?.get(rest);
        if (
          options.ifMatches &&
          !(existing && matches(JSON.parse(existing.json), options.ifMatches))
        ) {
          throw new StoreConditionError(key, "ifMatches");
        }
        entries?.delete(rest);
      },

      async list(prefix, options: ListOptions = {}) {
        const { partition, rest: restPrefix } = splitListPrefix(prefix);
        const entries = [...(partitions.get(partition) ?? new Map<string, Stored>())]
          .filter(([rest, entry]) => rest.startsWith(restPrefix) && live(entry))
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        if (options.order === "desc") entries.reverse();
        return entries.slice(0, options.limit ?? entries.length).map(([rest, entry]) => ({
          key: `${partition}/${rest}`,
          value: JSON.parse(entry.json) as T,
        }));
      },
    };
  }

  function channel<T>(name: string, schema: ZodType<T>): Channel<T> {
    return {
      async publish(topic, message) {
        const json = JSON.stringify(schema.parse(message));
        for (const subscription of subscriptions) {
          if (subscription.channel !== name || subscription.topic !== topic) continue;
          if (!subscription.connection.connected) continue;
          // A timer, not a microtask: like a network, delivery happens after publish returns.
          setTimeout(() => {
            if (subscriptions.has(subscription) && subscription.connection.connected) {
              subscription.handler(JSON.parse(json));
            }
          }, 0);
        }
      },
    };
  }

  const server: PlatformServer = {
    store,
    channel,
    async secret(name) {
      const value = options.secrets?.[name];
      if (value === undefined) throw new Error(`The secret "${name}" is not set.`);
      return value;
    },
    now: () => now,
  };

  function connect(api: ServerApi): MemoryConnection {
    const state = { connected: true };
    const statusHandlers = new Set<(connected: boolean) => void>();

    const client: PlatformClient = {
      async call(method, args) {
        if (!state.connected) throw new PlatformDisconnectedError();
        const handler = Object.hasOwn(api, method) ? api[method] : undefined;
        if (!handler) throw new Error(`Unknown method "${method}".`);
        try {
          return roundTrip(await handler(...(roundTrip(args) as unknown[])));
        } catch (error) {
          const failure = new Error(error instanceof Error ? error.message : String(error));
          if (error instanceof Error) failure.name = error.name;
          throw failure;
        }
      },
      subscribe(channelName, topic, handler) {
        const subscription = { channel: channelName, topic, handler, connection: state };
        subscriptions.add(subscription);
        return () => {
          subscriptions.delete(subscription);
        };
      },
      onStatus(handler) {
        statusHandlers.add(handler);
        return () => {
          statusHandlers.delete(handler);
        };
      },
    };

    return {
      client,
      get connected() {
        return state.connected;
      },
      setConnected(connected) {
        if (state.connected === connected) return;
        state.connected = connected;
        for (const handler of statusHandlers) setTimeout(() => handler(connected), 0);
      },
    };
  }

  return {
    server,
    clock,
    connect,
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}
