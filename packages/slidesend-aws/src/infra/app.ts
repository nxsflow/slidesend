#!/usr/bin/env node
/**
 * The CDK app of the bootstrap stack, so the talk project holds no CDK code of its own (spec §4).
 * `slidesend bootstrap` runs the CDK CLI against this file and passes everything it verified in
 * one environment variable:
 *
 *     npx cdk deploy --app "node node_modules/@nxsflow/slidesend-aws/dist/infra/app.js"
 *
 * The values come from the checks, not from a second configuration file that could disagree with
 * them.
 */
import { App } from "aws-cdk-lib";
import { BootstrapStack } from "./bootstrap-stack";
import { bootstrapInput } from "./input";

const { stackName, account, region, ...rest } = bootstrapInput(process.env.SLIDESEND_BOOTSTRAP);
const app = new App();
// The account is bound to the stack rather than taken from whatever credentials are present:
// CDK then refuses to touch a different account before the first write, instead of after it.
new BootstrapStack(app, stackName, { ...rest, env: { account, region } });
app.synth();
