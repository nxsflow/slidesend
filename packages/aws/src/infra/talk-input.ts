/**
 * What `slidesend deploy` and `slidesend destroy` hand the talk's CDK app, and how it is read
 * back. It lives apart from `talk-app.ts` because that file builds a stack the moment it is
 * imported.
 */

/** What `slidesend deploy` puts into `SLIDESEND_DEPLOY`. */
export interface TalkInput {
  /** The stack's name in CloudFormation: `<stackId>-prod`, as AWS Blocks names a production. */
  stackName: string;
  /** The talk project's folder, where `aws-blocks/index.ts` lives. */
  projectRoot: string;
  account: string;
  region: string;
  /** A custom domain whose hosted zone the bootstrap stack created, if the talk has one. */
  domain?: string;
  /** The command that builds the site; it runs while the stack is synthesized. */
  buildCommand: string;
}

/** Reads the input, so a missing or broken variable fails with a sentence, not a stack trace. */
export function talkInput(raw: string | undefined): TalkInput {
  if (!raw) throw new Error("SLIDESEND_DEPLOY is not set; run `slidesend deploy`.");
  let parsed: TalkInput;
  try {
    parsed = JSON.parse(raw) as TalkInput;
  } catch {
    throw new Error("SLIDESEND_DEPLOY is not valid JSON; run `slidesend deploy`.");
  }
  for (const key of ["stackName", "projectRoot", "account", "region", "buildCommand"] as const) {
    if (!parsed[key]) throw new Error(`SLIDESEND_DEPLOY is missing "${key}".`);
  }
  return parsed;
}
