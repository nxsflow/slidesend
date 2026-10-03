import { definePlugin } from "@nxsflow/slidesend-core";
import { poll } from "./activities/poll";
import { link, text, wait } from "./activities/simple";
import { pollList, pollMatrix } from "./blocks/poll-blocks";
import { qr } from "./blocks/qr";
import { diff, image, list, quote, reveal, statement, timeline } from "./blocks/text-blocks";
import { textList } from "./blocks/text-list";
import { basicsMessages } from "./messages";
import { section } from "./section";

/** Everything `@nxsflow/slidesend-basics` provides: the section template and the generic blocks. */
export function basics() {
  return definePlugin({
    name: "basics",
    slides: [section],
    blocks: [
      statement,
      quote,
      list,
      timeline,
      diff,
      reveal,
      image,
      qr,
      pollMatrix,
      pollList,
      textList,
    ],
    activities: [poll, text, wait, link],
    messages: basicsMessages,
  });
}
