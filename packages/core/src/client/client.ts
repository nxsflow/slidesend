import type { PlatformClient } from "../platform/contract";
import type { ServerApi } from "../server/api";
import type { CoreApi } from "../server/runtime";
import { type ActivityResponse, channels } from "../sessions/runtime-types";

/** Each server method, as a client calls it: same arguments, the result as a promise. */
export type TypedClient<Api extends ServerApi> = {
  readonly [Name in keyof Api]: (
    ...args: Parameters<Api[Name]>
  ) => Promise<Awaited<ReturnType<Api[Name]>>>;
};

/**
 * Typed wrappers over `PlatformClient.call`: `client.cursorGet(sessionId)` calls the server
 * method `cursorGet`. Only the types come from the server; no server code reaches the browser.
 */
export function typedClient<Api extends ServerApi>(platform: PlatformClient): TypedClient<Api> {
  return new Proxy({} as TypedClient<Api>, {
    get(_, name) {
      // Not a thenable: `await client` must not call a server method named "then".
      if (typeof name !== "string" || name === "then") return undefined;
      return (...args: unknown[]) => {
        // JSON would turn trailing undefined arguments into null; leave them out instead.
        let length = args.length;
        while (length > 0 && args[length - 1] === undefined) length--;
        return platform.call(name, args.slice(0, length));
      };
    },
  });
}

/** The typed client of core's server API. */
export type CoreClient = TypedClient<CoreApi>;

/**
 * What core hands to a simple activity (spec §6.4): write a response, read one's own responses,
 * and follow all responses of the activity. Everything is scoped to one session, activity and
 * device.
 */
export interface ResponseStore {
  /** Writes a response; without `multiple`, it replaces this device's earlier one. */
  write(value: unknown, options?: { multiple?: boolean }): Promise<ActivityResponse>;
  /** This device's responses, e.g. to restore the form after the phone was locked. */
  mine(): Promise<ActivityResponse[]>;
  /**
   * Follows all responses of the activity: `handler` gets the full list at once and again on
   * every change. It subscribes before it loads, and loads again after every reconnect, so no
   * response is lost. Returns a function that stops following.
   */
  follow(handler: (responses: ActivityResponse[]) => void): () => void;
}

/** Options of `responseStore`. */
export interface ResponseStoreOptions {
  platform: PlatformClient;
  sessionId: string;
  activityId: string;
  deviceId: string;
}

/** The response store of one activity in one session, for one device. */
export function responseStore(options: ResponseStoreOptions): ResponseStore {
  const { platform, sessionId, activityId, deviceId } = options;
  const api = typedClient<CoreApi>(platform);

  return {
    write: (value, writeOptions) =>
      api.responseWrite(sessionId, activityId, deviceId, value, writeOptions),
    mine: () => api.responsesMine(sessionId, activityId, deviceId),
    follow(handler) {
      const byKey = new Map<string, ActivityResponse>();
      let active = true;
      const emit = () => {
        if (active) handler([...byKey.values()].sort((a, b) => a.at - b.at));
      };
      const merge = (response: ActivityResponse) => {
        const known = byKey.get(response.key);
        if (!known || known.at <= response.at) byKey.set(response.key, response);
      };
      const load = async () => {
        try {
          for (const response of await api.responsesFor(sessionId, activityId)) merge(response);
          emit();
        } catch {
          // The next reconnect loads again; a closed session simply stays as it was.
        }
      };
      const stopMessages = platform.subscribe(
        channels.responses,
        `${sessionId}/${activityId}`,
        (message) => {
          merge(message as ActivityResponse);
          emit();
        },
      );
      const stopStatus = platform.onStatus((connected) => {
        if (connected) void load();
      });
      void load();
      return () => {
        active = false;
        stopMessages();
        stopStatus();
      };
    },
  };
}
