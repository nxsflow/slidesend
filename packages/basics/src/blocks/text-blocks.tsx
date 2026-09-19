import { cssVariable, defineBlock, stepMeta } from "@slidesend/core";
import { z } from "zod";
import { RichText } from "./rich-text";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;
const display = `var(${cssVariable("font", "display")})`;
const accent = "var(--slidesend-accent)";

/** One sentence that stands alone. */
export const statement = defineBlock({
  type: "statement",
  schema: z.object({
    text: z.string().min(1),
    /** `large` fills the slide; `medium` leaves room for more. */
    size: z.enum(["medium", "large"]).default("large"),
  }),
  Component: ({ data }) => (
    <p
      data-block="statement"
      style={{
        fontFamily: display,
        fontSize: data.size === "large" ? 88 : 64,
        lineHeight: 1.2,
        margin: 0,
        color: color("text"),
      }}
    >
      <RichText text={data.text} />
    </p>
  ),
});

/** A quotation with its source. */
export const quote = defineBlock({
  type: "quote",
  schema: z.object({ text: z.string().min(1), source: z.string().optional() }),
  Component: ({ data }) => (
    <figure
      data-block="quote"
      style={{ margin: 0, borderLeft: `8px solid ${accent}`, paddingLeft: 40 }}
    >
      <blockquote style={{ margin: 0, fontFamily: display, fontSize: 64, lineHeight: 1.25 }}>
        <RichText text={data.text} />
      </blockquote>
      {data.source && (
        <figcaption style={{ marginTop: 24, fontSize: 32, color: color("textMuted") }}>
          {data.source}
        </figcaption>
      )}
    </figure>
  ),
});

/** A list, numbered or not; long lists stand in two columns. */
export const list = defineBlock({
  type: "list",
  schema: z.object({
    items: z.array(z.string().min(1)).min(1),
    ordered: z.boolean().default(false),
    /** More items than this stand in two columns. */
    columnsFrom: z.number().int().min(2).default(7),
  }),
  Component: ({ data }) => {
    const Tag = data.ordered ? "ol" : "ul";
    return (
      <Tag
        data-block="list"
        data-columns={data.items.length >= data.columnsFrom ? 2 : 1}
        style={{
          margin: 0,
          fontSize: 48,
          lineHeight: 1.45,
          columns: data.items.length >= data.columnsFrom ? 2 : 1,
          columnGap: 80,
        }}
      >
        {data.items.map((item) => (
          <li key={item} style={{ breakInside: "avoid", marginBottom: 12 }}>
            <RichText text={item} />
          </li>
        ))}
      </Tag>
    );
  },
});

/** Stations on a line, in order. */
export const timeline = defineBlock({
  type: "timeline",
  schema: z.object({
    entries: z.array(z.object({ label: z.string().min(1), text: z.string().optional() })).min(2),
  }),
  Component: ({ data }) => (
    <div data-block="timeline" style={{ display: "flex", gap: 32, alignItems: "stretch" }}>
      {data.entries.map((entry) => (
        <div
          key={entry.label}
          style={{ flex: 1, borderTop: `6px solid ${accent}`, paddingTop: 24 }}
        >
          <div style={{ fontFamily: display, fontSize: 40, marginBottom: 12 }}>{entry.label}</div>
          {entry.text && (
            <div style={{ fontSize: 32, color: color("textMuted"), lineHeight: 1.35 }}>
              <RichText text={entry.text} />
            </div>
          )}
        </div>
      ))}
    </div>
  ),
});

/** Before and after, with an optional number between them. */
export const diff = defineBlock({
  type: "diff",
  schema: z.object({
    before: z.object({ label: z.string().min(1), text: z.string().min(1) }),
    after: z.object({ label: z.string().min(1), text: z.string().min(1) }),
    number: z.object({ value: z.string().min(1), caption: z.string().optional() }).optional(),
  }),
  Component: ({ data }) => (
    <div
      data-block="diff"
      style={{ display: "flex", gap: 48, alignItems: "center", width: "100%" }}
    >
      {[data.before, data.after].map((side, index) => (
        <div
          key={side.label}
          data-side={index === 0 ? "before" : "after"}
          style={{
            flex: 1,
            background: color("surface"),
            border: `2px solid ${index === 0 ? color("border") : accent}`,
            borderRadius: `var(${cssVariable("radius", "large")})`,
            padding: 40,
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: "0.08em", color: color("textMuted") }}>
            {side.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 44, lineHeight: 1.3, marginTop: 16 }}>
            <RichText text={side.text} />
          </div>
        </div>
      ))}
      {data.number && (
        <div data-number style={{ textAlign: "center", flex: "none" }}>
          <div style={{ fontFamily: display, fontSize: 120, color: accent, lineHeight: 1 }}>
            {data.number.value}
          </div>
          {data.number.caption && (
            <div style={{ fontSize: 28, color: color("textMuted"), marginTop: 12 }}>
              {data.number.caption}
            </div>
          )}
        </div>
      )}
    </div>
  ),
});

/** Items that appear one click at a time; it reports its own steps. */
export const reveal = defineBlock({
  type: "reveal",
  schema: z.object({
    items: z.array(z.object({ text: z.string().min(1), ...stepMeta })).min(1),
    ordered: z.boolean().default(false),
  }),
  steps: (data) => data.items.length,
  describe: (data) => ({
    label: data.items[0]?.text ?? "reveal",
    steps: data.items.map(({ text: _text, ...meta }) => meta),
  }),
  Component: ({ data, step }) => {
    const Tag = data.ordered ? "ol" : "ul";
    return (
      <Tag data-block="reveal" style={{ margin: 0, fontSize: 52, lineHeight: 1.4 }}>
        {data.items.map((item, index) => (
          <li
            key={item.text}
            data-item={index}
            data-shown={index <= step || undefined}
            style={{
              opacity: index <= step ? 1 : 0,
              transform: index <= step ? "none" : "translateY(12px)",
              transition: "opacity 300ms ease-out, transform 300ms ease-out",
              marginBottom: 16,
            }}
          >
            <RichText text={item.text} />
          </li>
        ))}
      </Tag>
    );
  },
  Print: ({ data }) => (
    <ul data-block="reveal">
      {data.items.map((item) => (
        <li key={item.text}>{item.text}</li>
      ))}
    </ul>
  ),
});

/** A picture, with an optional caption. */
export const image = defineBlock({
  type: "image",
  schema: z.object({
    src: z.string().min(1),
    /** What the picture shows, for people who cannot see it. */
    alt: z.string().min(1),
    caption: z.string().optional(),
    fit: z.enum(["contain", "cover"]).default("contain"),
  }),
  Component: ({ data }) => (
    <figure
      data-block="image"
      style={{ margin: 0, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <img
        src={data.src}
        alt={data.alt}
        style={{
          width: "100%",
          minHeight: 0,
          flex: 1,
          objectFit: data.fit,
          borderRadius: `var(${cssVariable("radius", "large")})`,
        }}
      />
      {data.caption && (
        <figcaption style={{ marginTop: 20, fontSize: 30, color: color("textMuted") }}>
          {data.caption}
        </figcaption>
      )}
    </figure>
  ),
});
