import {
  ApiNamespace,
  AppSetting,
  DistributedTable,
  Realtime,
  type Scope,
} from "@aws-blocks/blocks";
import type { CoreApi, PlatformServer, Presentation } from "@slidesend/core";
import { controlSecretName, createServer, open, type ServerApi } from "@slidesend/core/server";
import { z } from "zod";
import { type AwsBlocks, blocksPlatform, realtimeChannel, realtimeNamespace } from "./platform";

const rowSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  value: z.string(),
  version: z.string(),
  ttl: z.number().optional(),
});

/** The methods of slidesend's API on AWS: core's API plus `subscribe`. */
export type AwsApi = CoreApi & {
  subscribe(channel: string, topic: string): Promise<unknown>;
};

/** What `createAwsBackend` returns. Export only `api` from `aws-blocks/index.ts`. */
export interface AwsBackend {
  /** The API namespace to export as `slidesend`. */
  api: AwsApi;
  /** The same methods, for tests and for other backend code. */
  methods: AwsApi;
  /** The platform contract on the blocks, e.g. for a plugin's server half. */
  platform: PlatformServer;
  /** Core's server logic on that platform. */
  server: ReturnType<typeof createServer>;
  blocks: AwsBlocks;
  /** The Realtime block; its local mock can also subscribe on the server, for tests. */
  realtime: unknown;
  plugins: Record<string, never>;
}

/**
 * Creates slidesend's backend inside the talk project's scope (spec §4.1). AWS Blocks needs the
 * talk project to own `aws-blocks/index.ts`, and it takes the name of an exported variable as
 * the API namespace, so the project exports exactly this:
 *
 * ```ts
 * // aws-blocks/index.ts
 * import { Scope } from "@aws-blocks/blocks";
 * import { createAwsBackend } from "@slidesend/aws/server";
 * import config from "../presentation.config";
 *
 * const backend = createAwsBackend(new Scope("my-talk"), config);
 * export const slidesend = backend.api;
 * ```
 *
 * Export only API namespaces, never `backend` itself: every exported object becomes a public
 * API namespace. Block ids are short on purpose; S3 bucket names built from stack id and block
 * id must stay within 63 characters.
 */
export function createAwsBackend(scope: Scope, config: Presentation): AwsBackend {
  const table = new DistributedTable(scope, "sd-data", {
    schema: rowSchema,
    key: { partitionKey: "pk", sortKey: "sk" },
    ttl: "ttl",
  });
  const realtime = new Realtime(scope, "sd-rt", {
    namespaces: { [realtimeNamespace]: Realtime.namespace(z.unknown()) },
  });
  const control = new AppSetting(scope, "sd-control", { secret: true });
  const blocks: AwsBlocks = {
    table: table as AwsBlocks["table"],
    realtime,
    secrets: { [controlSecretName]: control },
  };
  const platform = blocksPlatform(blocks);
  const server = createServer({
    platform,
    defaultPlannedMinutes: config.meta.plannedMinutes ?? Math.max(1, config.plannedMinutes),
  });

  const methods = {
    ...server.api,
    /**
     * A channel descriptor for the browser; the client middleware turns it into a live
     * subscription. Channels carry cursor moves and responses, which the guarded reads return
     * anyway, so subscribing is open.
     */
    subscribe: open((channel: string, topic: string) =>
      realtime.getChannel(realtimeNamespace, realtimeChannel(channel, topic)),
    ),
  } satisfies ServerApi;

  const api = new ApiNamespace(scope, "slidesend", () => methods) as AwsApi;
  return { api, methods: methods as AwsApi, platform, server, blocks, realtime, plugins: {} };
}
