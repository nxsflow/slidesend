/**
 * What `slidesend bootstrap` hands the CDK app, and how it is read back. It lives apart from
 * `app.ts` because that file builds and synthesizes a stack the moment it is imported.
 */
import type { BootstrapStackProps } from "./bootstrap-stack";

/** What `slidesend bootstrap` puts into `SLIDESEND_BOOTSTRAP`. */
export interface BootstrapInput extends Omit<BootstrapStackProps, "env"> {
  /** The stack's name in CloudFormation, e.g. `"sd-gravity-bootstrap"`. */
  stackName: string;
  account: string;
  region: string;
}

/** Reads the input, so a missing or broken variable fails with a sentence, not a stack trace. */
export function bootstrapInput(raw: string | undefined): BootstrapInput {
  if (!raw) throw new Error("SLIDESEND_BOOTSTRAP is not set; run `slidesend bootstrap`.");
  let parsed: BootstrapInput;
  try {
    parsed = JSON.parse(raw) as BootstrapInput;
  } catch {
    throw new Error("SLIDESEND_BOOTSTRAP is not valid JSON; run `slidesend bootstrap`.");
  }
  for (const key of ["stackName", "account", "region", "roleName", "environment"] as const) {
    if (!parsed[key]) throw new Error(`SLIDESEND_BOOTSTRAP is missing "${key}".`);
  }
  if (!parsed.repository?.id) throw new Error('SLIDESEND_BOOTSTRAP is missing "repository".');
  return parsed;
}
