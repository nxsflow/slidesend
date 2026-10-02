/**
 * Browser entry of `@slidesend/aws`. Everything exported here may end up in the phone bundle,
 * so this module and its imports must never reach `./server`.
 */
import type { Platform, PlatformCommandContext } from "@slidesend/core";

export const packageName = "@slidesend/aws";

export { awsClient, type SlidesendNamespace } from "./client/client";

/** Options of `aws`. */
export interface AwsOptions {
  /** The AWS region to deploy to, e.g. `"eu-central-1"`. */
  region: string;
  /** An optional custom domain, e.g. `"talk.example.com"`. */
  domain?: string;
}

/** The AWS platform as `presentation.config.ts` installs it (spec §4.1). */
export interface AwsPlatform extends Platform {
  readonly name: "aws";
  readonly region: string;
  readonly domain?: string;
}

/**
 * Selects AWS as the talk's platform: `platform: aws({ region: "eu-central-1" })`. The backend
 * itself is created in the project's `aws-blocks/index.ts` with `createAwsBackend`.
 */
export function aws(options: AwsOptions): AwsPlatform {
  const defaults = {
    region: options.region,
    ...(options.domain ? { domain: options.domain } : {}),
  };
  return {
    name: "aws",
    region: options.region,
    ...(options.domain ? { domain: options.domain } : {}),
    commands: {
      dev: {
        description:
          "Runs the talk on the AWS Blocks dev server with local mocks and prints the desk link.",
        run: async (context) => (await commands()).dev(context),
      },
      bootstrap: {
        description:
          "Checks every precondition of a first deployment and, with --deploy, creates the OIDC provider and the deploy role.",
        run: async (context) => (await commands()).bootstrap(context, defaults),
      },
      deploy: {
        description:
          "Builds the site, deploys the talk's stack <stackId>-prod and prints the desk link with the control secret. Options: --profile, --region.",
        run: async (context) => (await commands()).deploy(context, defaults),
      },
      open: {
        description:
          "Prints the desk link of the deployed talk again. Options: --profile, --region.",
        run: async (context) => (await commands()).open(context, defaults),
      },
      destroy: {
        description:
          "Removes the talk's stack, its data included, and says what stays: the bootstrap stack, the CDK bootstrap, a hosted zone. Options: --profile, --region.",
        run: async (context) => (await commands()).destroy(context, defaults),
      },
      workflow: {
        description:
          "Writes the GitHub Actions workflow that checks the talk and deploys it via OIDC to .github/workflows/deploy.yml. Option: --force to overwrite.",
        run: async (context) => (await commands()).workflow(context),
      },
    },
  };
}

// The commands need Node. A specifier in a variable keeps bundlers from following the import,
// so the browser never loads them; only `slidesend` does, in Node.
const commandsModule = "@slidesend/aws/commands";
const commands = () =>
  import(/* @vite-ignore */ commandsModule) as Promise<{
    dev(context: PlatformCommandContext): Promise<void>;
    bootstrap(context: PlatformCommandContext, defaults: AwsDefaults): Promise<void>;
    deploy(context: PlatformCommandContext, defaults: AwsDefaults): Promise<void>;
    open(context: PlatformCommandContext, defaults: AwsDefaults): Promise<void>;
    destroy(context: PlatformCommandContext, defaults: AwsDefaults): Promise<void>;
    workflow(context: PlatformCommandContext): Promise<void>;
  }>;

type AwsDefaults = { region?: string; domain?: string };
