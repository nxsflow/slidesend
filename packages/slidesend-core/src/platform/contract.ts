import type { ZodType } from "zod";

/**
 * The server half of a hosting platform (spec §8). Core's server logic (sessions, cursor,
 * responses, presence, timings, guards) is written against this contract only.
 */
export interface PlatformServer {
  /** A named store of values that pass `schema`. The same name always yields the same data. */
  store<T>(name: string, schema: ZodType<T>): Store<T>;
  /** A named channel for messages that pass `schema`, pushed to subscribed clients. */
  channel<T>(name: string, schema: ZodType<T>): Channel<T>;
  /** Reads a secret, e.g. the control secret. Rejects if it is not set. */
  secret(name: string): Promise<string>;
  /** The current time in epoch milliseconds. Server logic reads time only from here. */
  now(): number;
}

/**
 * Durable key-value storage (spec §8).
 *
 * A key has the form `<partition>/<rest>`, e.g. `session-7/responses/mood/device-3`. The part
 * before the first `/` is the partition; `list` works only within one partition, because that is
 * what the hosted implementations can do efficiently. Keys should be ASCII; `list` orders them
 * by code unit.
 */
export interface Store<T> {
  /** The value under `key`, or `undefined` if there is none or it has expired. */
  get(key: string): Promise<T | undefined>;
  /**
   * Stores `value` under `key`. Rejects with a `StoreConditionError` if a condition in `options`
   * does not hold, and with an error if `value` does not pass the store's schema or is too large.
   */
  put(key: string, value: T, options?: PutOptions<T>): Promise<void>;
  /** Deletes `key`; deleting a missing key is not an error unless `options` asks for a match. */
  delete(key: string, options?: DeleteOptions<T>): Promise<void>;
  /**
   * The entries whose keys start with `prefix`, ordered by key. `prefix` must name a full
   * partition, e.g. `session-7/` or `session-7/responses/`; anything else is rejected.
   */
  list(prefix: string, options?: ListOptions): Promise<StoreEntry<T>[]>;
}

/** One entry returned by `Store.list`. */
export interface StoreEntry<T> {
  key: string;
  value: T;
}

/** Conditions and expiry of `Store.put`. At most one of `ifAbsent` and `ifMatches` may be set. */
export type PutOptions<T> = {
  /** Epoch ms after which the value counts as gone; the platform removes it eventually. */
  expiresAt?: number;
} & (
  | { ifAbsent?: undefined; ifMatches?: undefined }
  /** Only write if the key holds no value. */
  | { ifAbsent: true; ifMatches?: undefined }
  /** Only write if the stored value has these field values. */
  | { ifAbsent?: undefined; ifMatches: Partial<T> }
);

/** Conditions of `Store.delete`. */
export interface DeleteOptions<T> {
  /** Only delete if the stored value has these field values; fails if there is none. */
  ifMatches?: Partial<T>;
}

/** Options of `Store.list`. */
export interface ListOptions {
  /** Return at most this many entries. */
  limit?: number;
  /** Key order; ascending by default. */
  order?: "asc" | "desc";
}

/** A named channel on the server side (spec §8). */
export interface Channel<T> {
  /** Sends `message` to every client subscribed to this channel and topic at this moment. */
  publish(topic: string, message: T): Promise<void>;
}

/**
 * The client half of a hosting platform (spec §8): what stage, desk and phones use. Typed
 * wrappers sit on top of it.
 */
export interface PlatformClient {
  /** Calls a server method with JSON-serializable arguments and returns its JSON result. */
  call(method: string, args: unknown[]): Promise<unknown>;
  /**
   * Receives messages published on `channel` and `topic` from now on. Messages published while
   * the client is disconnected are lost; fetch the current state after every reconnect.
   * Returns a function that ends the subscription.
   */
  subscribe(channel: string, topic: string, handler: (message: unknown) => void): () => void;
  /** Reports connection changes. Returns a function that stops the reports. */
  onStatus(handler: (connected: boolean) => void): () => void;
}

/** Rejects a `Store.put` or `Store.delete` whose condition does not hold. */
export class StoreConditionError extends Error {
  constructor(key: string, condition: string) {
    super(`The condition "${condition}" does not hold for the key "${key}".`);
    this.name = "StoreConditionError";
  }
}

/** Rejects a `PlatformClient.call` made while the client is disconnected. */
export class PlatformDisconnectedError extends Error {
  constructor() {
    super("The platform is not connected.");
    this.name = "PlatformDisconnectedError";
  }
}

/** The largest serialized value a store accepts, in bytes; hosted stores have similar limits. */
export const maxValueBytes = 350_000;

const encoder = new TextEncoder();

/**
 * Splits a store key into partition and rest, and rejects a malformed one. Platform
 * implementations use it, so that every platform accepts exactly the same keys.
 */
export function splitStoreKey(key: string): { partition: string; rest: string } {
  const slash = key.indexOf("/");
  const partition = key.slice(0, slash);
  const rest = key.slice(slash + 1);
  if (slash <= 0 || rest === "") {
    throw new Error(`The store key "${key}" must have the form "<partition>/<rest>".`);
  }
  if (encoder.encode(partition).length > 512 || encoder.encode(rest).length > 1024) {
    throw new Error(`The store key "${key}" is too long.`);
  }
  return { partition, rest };
}

/** Splits a `list` prefix into partition and the prefix of the rest, and rejects a partial one. */
export function splitListPrefix(prefix: string): { partition: string; rest: string } {
  const slash = prefix.indexOf("/");
  if (slash <= 0) {
    throw new Error(
      `The list prefix "${prefix}" must name a full partition, e.g. "session-7/"; lists across partitions are not supported.`,
    );
  }
  return { partition: prefix.slice(0, slash), rest: prefix.slice(slash + 1) };
}

/** The serialized size of a value in bytes, as the stores count it. */
export function serializedBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}
