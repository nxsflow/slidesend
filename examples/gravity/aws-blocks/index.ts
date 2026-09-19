/**
 * The example talk's backend on AWS Blocks. AWS Blocks needs the talk project to own this file,
 * and it takes the name of each exported variable as an API namespace (spec §4.1).
 */
import { Scope } from "@aws-blocks/blocks";
import { createAwsBackend } from "@slidesend/aws/server";
import config from "../presentation.config";

const backend = createAwsBackend(new Scope("gravity"), config);
export const slidesend = backend.api;
