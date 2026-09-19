/**
 * The CDK half of `@slidesend/aws` (spec §14). Node only, and CDK only: nothing here may be
 * imported from a browser bundle, and the talk project needs it only to write its own app —
 * `slidesend bootstrap` runs the one this package ships.
 */
export {
  BootstrapStack,
  type BootstrapStackProps,
  cdkQualifier,
} from "./infra/bootstrap-stack";
export { type BootstrapInput, bootstrapInput } from "./infra/input";
export { deploySubject, type Repository } from "./infra/subject";
