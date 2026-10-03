/**
 * The talk's backend on AWS Blocks. AWS Blocks needs the project to own this file, and it takes
 * the name of every exported variable as an API namespace: export only `slidesend`, never the
 * backend object itself.
 */
import { Scope } from "@aws-blocks/blocks";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";

const backend = createAwsBackend(new Scope("talk"), config);
export const slidesend = backend.api;
