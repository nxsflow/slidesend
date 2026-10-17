/**
 * The Lambda entry of the talk's backend. AWS Blocks serves every export of `index.ts` to anyone,
 * so the entry refuses to start when `index.ts` exports anything but API namespaces.
 */
import { createLambdaHandler } from "@aws-blocks/blocks/lambda-handler";
import { onlyApiNamespaces } from "@slidesend/aws/server";

export const handler = createLambdaHandler(() => import("./index.js").then(onlyApiNamespaces));
