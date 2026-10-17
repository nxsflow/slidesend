/**
 * The mark `new ApiNamespace(scope, name, handler)` puts on the handler it returns. AWS Blocks
 * keeps it in the global symbol registry, so it holds across duplicate copies of the library.
 */
const apiNamespaceMarker = Symbol.for("blocks:ApiNamespace");

const isApiNamespace = (value: unknown): boolean =>
  typeof value === "function" &&
  typeof (value as unknown as Record<symbol, unknown>)[apiNamespaceMarker] === "string";

/**
 * Refuses a backend entry module that exports anything but API namespaces, and returns it
 * otherwise. AWS Blocks answers POST /aws-blocks/api for any export of `aws-blocks/index.ts`
 * without authentication; since 0.8.0 it skips a Scope, a building block and secret()/config(),
 * but it still serves a plain function or object, such as the whole `createAwsBackend` result.
 * So the talk's Lambda entry runs the module through this before AWS Blocks sees it:
 *
 * ```ts
 * // aws-blocks/index.handler.ts
 * export const handler = createLambdaHandler(() => import("./index.js").then(onlyApiNamespaces));
 * ```
 *
 * It throws naming every other export, so a cold start fails instead of serving it.
 */
export function onlyApiNamespaces<Entry extends object>(entry: Entry): Entry {
  const refused = Object.entries(entry)
    .filter(([, value]) => !isApiNamespace(value))
    .map(([name]) => `"${name}"`);
  if (refused.length > 0) {
    throw new Error(
      `aws-blocks/index.ts may export only API namespaces, because AWS Blocks serves every export ` +
        `to anyone. Not an API namespace: ${refused.join(", ")}. Export only the \`api\` of ` +
        `createAwsBackend and createAgentChat, and keep the Scope, blocks, the backend object, ` +
        `helpers and configuration unexported.`,
    );
  }
  return entry;
}
