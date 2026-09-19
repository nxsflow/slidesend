import { definePlugin } from "@slidesend/core";
import { section } from "./section";

/**
 * The basics plugin: the `section` template, and the generic blocks and activities as they
 * arrive. Install it with `plugins: [basics(), ...]`.
 */
export function basics() {
  return definePlugin({ name: "basics", slides: [section] });
}
