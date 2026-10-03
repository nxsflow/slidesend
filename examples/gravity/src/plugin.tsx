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

/**
 * The Moon's orbit, drawn in three clicks (spec §6.2): the Earth, the fall that would hit it,
 * and the sideways motion that turns the fall into a circle.
 *
 * A talk-specific block: it says one thing, in one talk, and it is the reason a plugin exists at
 * all — nothing in `@slidesend/basics` should know what an orbit is.
 */
// snippet: define-block
export const orbit = defineBlock({
  type: "orbit",
  schema: z.object({
    captions: z.array(z.object({ text: z.string(), ...stepMeta })).length(3),
  }),
  steps: (data) => data.captions.length,
  describe: (data) => ({
    label: "Orbit",
    steps: data.captions.map(({ text: _text, ...meta }) => meta),
  }),
  Component: ({ data, step }) => (
    <figure style={{ margin: 0, display: "grid", gap: 24, justifyItems: "center" }}>
      <svg
        viewBox="0 0 520 380"
        width={1080}
        role="img"
        aria-label="The Moon falls towards the Earth and keeps missing it"
      >
        <title>The Moon falls towards the Earth and keeps missing it</title>
        {/* The Earth is there from the first click; everything else answers it. */}
        <circle cx="260" cy="190" r="54" fill={token.accent} />
        {step >= 1 && (
          <g data-fall>
            <line
              x1="260"
              y1="190"
              x2="430"
              y2="190"
              stroke={token.muted}
              strokeWidth="4"
              strokeDasharray="10 10"
            />
            <circle cx="430" cy="190" r="18" fill={token.text} />
          </g>
        )}
        {step >= 2 && (
          <ellipse
            data-path
            cx="260"
            cy="190"
            rx="170"
            ry="170"
            fill="none"
            stroke={token.text}
            strokeWidth="3"
            opacity="0.7"
          />
        )}
      </svg>
      <figcaption data-caption style={{ fontSize: 40, color: token.muted, margin: 0 }}>
        {data.captions[Math.min(step, data.captions.length - 1)]?.text}
      </figcaption>
    </figure>
  ),
});

// end snippet

/** The example talk's own plugin: the nodes it needs beyond the basics. */
export const gravityPlugin = definePlugin({ name: "gravity", blocks: [fact, sequence, orbit] });
