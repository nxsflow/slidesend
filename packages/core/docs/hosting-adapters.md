# Hosting adapters

Slidesend's server logic (sessions, cursor, answers, presence, timings and the guards) is
written against a small platform contract. `@slidesend/aws` is the only implementation today.
To host a talk elsewhere, write a platform package with the same three parts. This page is for
whoever writes one; a talk only ever *installs* a platform.

## The three parts

| Part | Where it runs | What it does |
|---|---|---|
| `Platform` | `presentation.config.ts` | Names the platform and contributes commands, docs and CI templates. |
| `PlatformServer` | the backend | Storage, push channels, secrets and the clock, for core's server logic. |
| `PlatformClient` | stage, desk, phones | Calls server methods and receives pushed messages. |

Keep them in separate entry points like the other packages do: `.` for the browser
(`Platform` factory, client) and `./server` for the backend. A test in this repository asserts
that no browser entry imports a server entry.

## `Platform`: what a talk installs

```ts
interface Platform {
  readonly name: string;                                   // e.g. "aws"
  readonly commands?: Record<string, PlatformCommand>;     // added to `slidesend`
  readonly docs?: string;                                  // absolute path of the docs folder
  readonly ciTemplates?: Record<string, string>;           // name → absolute file path
}

interface PlatformCommand {
  description: string;                                     // one line for `slidesend help`
  run(context: { projectRoot: string; args: readonly string[]; log(line: string): void }): Promise<void>;
}
```

A talk installs it as `platform: myPlatform({ ... })`. `slidesend <command>` runs a command of
the configured platform; `deploy`, `bootstrap`, `open` and `destroy` are the names users expect,
and `dev` replaces core's local dev server when present. A command that fails throws an `Error`
whose message tells the person what to do; `slidesend` prints the message, not a stack trace.

Load Node-only code lazily inside `run`, through a specifier bundlers cannot follow, so the
browser bundle never contains it. `@slidesend/aws` shows the pattern in its `aws()` factory.

## `PlatformServer`: what core's server needs

```ts
interface PlatformServer {
  store<T>(name: string, schema: ZodType<T>): Store<T>;
  channel<T>(name: string, schema: ZodType<T>): Channel<T>;
  secret(name: string): Promise<string>;
  now(): number;
}

interface Store<T> {
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T, options?: PutOptions<T>): Promise<void>;
  delete(key: string, options?: DeleteOptions<T>): Promise<void>;
  list(prefix: string, options?: ListOptions): Promise<StoreEntry<T>[]>;
}

interface Channel<T> {
  publish(topic: string, message: T): Promise<void>;
}
```

The semantics are fixed by the in-memory implementation and its tests, and a hosted one must
match them:

- **Keys** have the form `<partition>/<rest>`. `list` works within one partition only, ordered by
  key; a prefix must name a full partition (`session-7/` or `session-7/responses/`). Use
  `splitStoreKey` and `splitListPrefix` from `@slidesend/core` so every platform accepts exactly
  the same keys.
- **Values** pass the store's schema and are at most `maxValueBytes` serialized
  (`serializedBytes`).
- **Conditional writes**: `ifAbsent`, or `ifMatches` with field values; a failed condition
  rejects with `StoreConditionError`. `expiresAt` lets a value lapse; it may linger until the
  platform removes it.
- **Channels** deliver to the clients subscribed at that moment. A message published while a
  client is disconnected is lost; core fetches the current state after every reconnect.
- **Secrets**: `secret(controlSecretName)` holds the control secret. Generate it at deploy time,
  never commit it.
- **Time** comes only from `now()`, so tests can move the clock.

Given an implementation, core's whole server is one call:

```ts
import { createServer } from "@slidesend/core/server";

const server = createServer({ platform, defaultPlannedMinutes: 20 });
// server.api: every method, each classified as open, control-guarded or session-guarded.
// Expose them under the namespace `slidesend`, and make `server.sessions.guards` available to
// plugins' server halves.
```

Test it with `createMemoryPlatform()` from `@slidesend/core/server` as the reference: run the
same scenarios against both.

## `PlatformClient`: what the views need

```ts
interface PlatformClient {
  call(method: string, args: unknown[]): Promise<unknown>;
  subscribe(channel: string, topic: string, handler: (message: unknown) => void): () => void;
  onStatus(handler: (connected: boolean) => void): () => void;
}
```

`call("cursorGet", [sessionId])` calls the server method of that name with JSON arguments;
methods of a plugin's namespace are called as `"agentChat.send"`. `subscribe` receives what the
server publishes on a channel and topic. `onStatus` reports connection changes, so the views can
say "connection lost" and catch up afterwards. The talk hands the client to `mount`:

```ts
mount(presentation, { platform: myPlatformClient() });
```

`httpPlatformClient()` from `@slidesend/core` is a complete client over HTTP and server-sent
events, the one the dev bridge uses; a platform can start from it.

## Server halves of plugins

An activity with its own backend (the agent chat) ships a factory per platform, which the talk
calls in its backend with the platform's `PlatformServer` and core's guards. A platform that
wants such a plugin needs its own server half for it; `@slidesend/agent` has one for AWS only.

## Checklist

- Core's server runs on the platform, and the scenarios of the in-memory tests pass against it.
- The views run against the client: a phone locked for a minute returns to the right slide
  (the lock check in `@slidesend/core/checks`).
- `slidesend deploy` prints a desk link with the control secret in the fragment, and nothing
  prints the secret in CI.
- The platform's docs cover prerequisites, cost while idle and in a session, the first deploy,
  and continuous deployment, like [deploy-aws](../../aws/docs/deploy-aws.md) and
  [continuous-deployment](../../aws/docs/continuous-deployment.md).
