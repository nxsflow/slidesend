import type { AppSetting, DistributedTable } from "@aws-blocks/blocks";
import {
  type Channel,
  maxValueBytes,
  type PlatformServer,
  type Store,
  StoreConditionError,
  serializedBytes,
  splitListPrefix,
  splitStoreKey,
} from "@slidesend/core";
import type { ZodType } from "zod";

/** One row of the table behind every store. */
export interface Row {
  /** `<store>#<partition>` */
  pk: string;
  /** The rest of the key. */
  sk: string;
  /** The value as JSON. */
  value: string;
  /** Changes with every write; conditional writes compare it. */
  version: string;
  /** Expiry in epoch seconds, as DynamoDB's time to live expects. */
  ttl?: number;
}

/** The blocks the platform runs on; `createAwsBackend` creates them. */
export interface AwsBlocks {
  table: DistributedTable<Row, { partitionKey: "pk"; sortKey: "sk" }>;
  realtime: { publish(namespace: string, channel: string, data: unknown): Promise<void> };
  secrets: Readonly<Record<string, Pick<AppSetting<string>, "get">>>;
}

/** The Realtime namespace every slidesend channel is published in. */
export const realtimeNamespace = "sd";

/** The Realtime channel of a slidesend channel and topic. */
export const realtimeChannel = (channel: string, topic: string) => `${channel}/${topic}`;

const conditionFailed = (error: unknown) =>
  (error as { name?: string })?.name === "ConditionalCheckFailedException" ||
  String((error as { message?: string })?.message ?? "").includes("ConditionalCheckFailed");

function matches(stored: unknown, expected: object): boolean {
  if (typeof stored !== "object" || stored === null) return false;
  return Object.entries(expected).every(
    ([field, value]) =>
      JSON.stringify((stored as Record<string, unknown>)[field]) === JSON.stringify(value),
  );
}

const newVersion = () => crypto.randomUUID();

/**
 * The platform contract of `@slidesend/core` on AWS Blocks (spec §8), as the spike decided: every
 * store lives in one DistributedTable with the partition key `<store>#<partition>` and the rest
 * of the key as sort key, so `list` is a query within one partition; channels are topics of one
 * Realtime namespace; secrets are AppSettings.
 */
export function blocksPlatform(blocks: AwsBlocks): PlatformServer {
  const { table } = blocks;
  const now = () => Date.now();
  const live = (row: Row | null | undefined) =>
    row && (row.ttl === undefined || row.ttl * 1000 > now()) ? row : undefined;

  function store<T>(name: string, schema: ZodType<T>): Store<T> {
    const address = (key: string) => {
      const { partition, rest } = splitStoreKey(key);
      return { pk: `${name}#${partition}`, sk: rest };
    };
    const read = (row: Row) => schema.parse(JSON.parse(row.value));

    return {
      async get(key) {
        const row = live(await table.get(address(key)));
        return row ? read(row) : undefined;
      },

      async put(key, value, options = {}) {
        const where = address(key);
        const parsed = schema.parse(value);
        if (serializedBytes(parsed) > maxValueBytes) {
          throw new Error(`The value for "${key}" is larger than ${maxValueBytes} bytes.`);
        }
        const row: Row = {
          ...where,
          value: JSON.stringify(parsed),
          version: newVersion(),
          ...(options.expiresAt !== undefined ? { ttl: Math.ceil(options.expiresAt / 1000) } : {}),
        };
        try {
          if (options.ifAbsent) {
            await table.put(row, { ifNotExists: true });
          } else if (options.ifMatches) {
            const current = await table.get(where);
            if (!current || !matches(JSON.parse(current.value), options.ifMatches)) {
              throw new StoreConditionError(key, "ifMatches");
            }
            await table.put(row, { ifFieldEquals: { version: current.version } });
          } else {
            await table.put(row);
          }
        } catch (error) {
          if (conditionFailed(error)) {
            throw new StoreConditionError(key, options.ifAbsent ? "ifAbsent" : "ifMatches");
          }
          throw error;
        }
      },

      async delete(key, options = {}) {
        const where = address(key);
        if (!options.ifMatches) {
          await table.delete(where);
          return;
        }
        const current = await table.get(where);
        if (!current || !matches(JSON.parse(current.value), options.ifMatches)) {
          throw new StoreConditionError(key, "ifMatches");
        }
        try {
          await table.delete(where, { ifFieldEquals: { version: current.version } });
        } catch (error) {
          if (conditionFailed(error)) throw new StoreConditionError(key, "ifMatches");
          throw error;
        }
      },

      async list(prefix, options = {}) {
        const { partition, rest } = splitListPrefix(prefix);
        const pk = `${name}#${partition}`;
        const rows: Row[] = [];
        for await (const row of table.query({
          where: rest ? { pk: { equals: pk }, sk: { beginsWith: rest } } : { pk: { equals: pk } },
          order: options.order ?? "asc",
        })) {
          rows.push(row);
        }
        // Expired rows stay until DynamoDB removes them, so they are filtered before the limit.
        return rows
          .filter((row) => live(row))
          .slice(0, options.limit ?? rows.length)
          .map((row) => ({ key: `${partition}/${row.sk}`, value: read(row) }));
      },
    };
  }

  function channel<T>(name: string, schema: ZodType<T>): Channel<T> {
    return {
      async publish(topic, message) {
        await blocks.realtime.publish(
          realtimeNamespace,
          realtimeChannel(name, topic),
          schema.parse(message),
        );
      },
    };
  }

  return {
    store,
    channel,
    async secret(name) {
      const setting = blocks.secrets[name];
      if (!setting) throw new Error(`The secret "${name}" is not set.`);
      const value = await setting.get();
      if (!value) throw new Error(`The secret "${name}" is not set.`);
      return value;
    },
    now,
  };
}
