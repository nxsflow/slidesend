import { definePlugin, defineSlide, FitBox, stepMeta } from "@slidesend/core";
import { z } from "zod";
import { token } from "./design";

/** A big title, alone on the stage. */
export const title = defineSlide({
  type: "title",
  schema: z.object({ title: z.string(), subtitle: z.string().optional(), ...stepMeta }),
  Component: ({ data, presence }) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 160px",
        opacity: presence === "leaving" ? 0 : 1,
        transition: "opacity 400ms",
      }}
    >
      <h1 style={{ fontFamily: token.display, fontSize: 128, margin: 0, color: token.accent }}>
        {data.title}
      </h1>
      {data.subtitle && <p style={{ fontSize: 48, color: token.muted }}>{data.subtitle}</p>}
    </div>
  ),
});

/** A heading with points that appear one click at a time. */
export const points = defineSlide({
  type: "points",
  schema: z.object({
    title: z.string(),
    items: z.array(z.object({ text: z.string(), ...stepMeta })).min(1),
  }),
  steps: (data) => data.items.length,
  describe: (data) => ({
    label: data.title,
    steps: data.items.map(({ text: _text, ...meta }) => meta),
  }),
  Component: ({ data, step }) => (
    <div style={{ position: "absolute", inset: 0, padding: "120px 160px" }}>
      <h2
        style={{ fontFamily: token.display, fontSize: 80, margin: "0 0 48px", color: token.accent }}
      >
        {data.title}
      </h2>
      <div style={{ height: 700 }}>
        <FitBox measureKey={step}>
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
        </FitBox>
      </div>
    </div>
  ),
});

/** The example talk's own plugin. */
export const gravityPlugin = definePlugin({ name: "gravity", slides: [title, points] });
