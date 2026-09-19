import { defineBlock, definePlugin, stepMeta } from "@slidesend/core";
import { z } from "zod";
import { token } from "./design";

/** One statement, large. */
export const fact = defineBlock({
  type: "fact",
  schema: z.object({ text: z.string() }),
  Component: ({ data }) => (
    <p data-fact style={{ fontFamily: token.display, fontSize: 88, lineHeight: 1.15, margin: 0 }}>
      {data.text}
    </p>
  ),
});

/** Observations that appear one click at a time, in place. */
export const sequence = defineBlock({
  type: "sequence",
  schema: z.object({ items: z.array(z.object({ text: z.string(), ...stepMeta })).min(1) }),
  steps: (data) => data.items.length,
  describe: (data) => ({
    label: data.items[0]?.text ?? "sequence",
    steps: data.items.map(({ text: _text, ...meta }) => meta),
  }),
  Component: ({ data, step }) => (
    <ul style={{ fontSize: 56, lineHeight: 1.4, margin: 0 }}>
      {data.items.map((item, index) => (
        <li
          key={item.text}
          data-point={index}
          style={{ opacity: index <= step ? 1 : 0, transition: "opacity 300ms" }}
        >
          {item.text}
        </li>
      ))}
    </ul>
  ),
});

/** The example talk's own plugin: the nodes it needs beyond the basics. */
export const gravityPlugin = definePlugin({ name: "gravity", blocks: [fact, sequence] });
