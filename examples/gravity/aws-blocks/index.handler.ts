/**
 * The Lambda entry of the example talk's backend. AWS Blocks needs the talk project to own this
 * file next to `index.ts`; `slidesend deploy` bundles it.
 */
import { createLambdaHandler } from "@aws-blocks/blocks/lambda-handler";

export const handler = createLambdaHandler(() => import("./index.js"));
