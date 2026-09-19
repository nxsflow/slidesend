import { definePlugin } from "@slidesend/core";
import { qr } from "./blocks/qr";
import { diff, image, list, quote, reveal, statement, timeline } from "./blocks/text-blocks";
import { basicsMessages } from "./messages";
import { section } from "./section";

/** Everything `@slidesend/basics` provides: the section template and the generic blocks. */
export function basics() {
  return definePlugin({
    name: "basics",
    slides: [section],
    blocks: [statement, quote, list, timeline, diff, reveal, image, qr],
    messages: basicsMessages,
  });
}
