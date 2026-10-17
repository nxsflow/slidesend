/**
 * The talk's backend on AWS Blocks. AWS Blocks needs the project to own this file, and it serves
 * every export of it to anyone, under the export's name. So export ONLY API namespaces (here
 * `slidesend`): never the Scope, building blocks, the backend object, helpers or configuration,
 * and no `export *`. `index.handler.ts` refuses to start otherwise, as do dev and deploy.
 */
import { Scope } from "@aws-blocks/blocks";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";

const backend = createAwsBackend(new Scope("talk"), config);
export const slidesend = backend.api;
