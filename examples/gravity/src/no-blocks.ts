/**
 * What `aws-blocks` is outside AWS mode: nothing.
 *
 * Its real client is generated before Vite starts, by `slidesend dev` or `vite build`. A local
 * run has no such file, and the import sits in the module graph even though nothing takes that
 * branch — so it resolves here instead, and would only be executed by a page that asked for the
 * AWS platform, which no local run does.
 */
export const slidesend = undefined;
