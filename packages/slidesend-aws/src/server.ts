/**
 * Server entry of `@nxsflow/slidesend-aws`: the backend that runs on AWS Blocks. Import it only from the
 * talk project's `aws-blocks/index.ts`.
 */
export const packageName = "@nxsflow/slidesend-aws";

export { type AwsApi, type AwsBackend, createAwsBackend } from "./server/backend";
export {
  type AwsBlocks,
  blocksPlatform,
  type Row,
  realtimeChannel,
  realtimeNamespace,
} from "./server/platform";
