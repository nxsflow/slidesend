import {
  type ActivityResponse,
  activityMeta,
  cssVariable,
  defineActivity,
  useResponseStore,
  useResponses,
  useText,
} from "@slidesend/core";
import { useEffect, useState } from "react";
import { z } from "zod";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/** The texts of every response, newest first. */
export function textResponses(responses: readonly ActivityResponse[]): ActivityResponse[] {
  return [...responses].filter((response) => typeof response.value === "string").reverse();
}

/**
 * A free-text question (spec §6.4). By default one answer per device, corrected by answering
 * again; with `multiple`, every answer is added.
 */
export const text = defineActivity({
  type: "text",
  schema: z.object({
    id: z.string(),
    prompt: z.string().min(1),
    /** Let one device send several answers, e.g. for a word cloud. */
    multiple: z.boolean().default(false),
    ...activityMeta,
  }),
  Participant: ({ data }) => {
    const store = useResponseStore();
    const strings = useText();
    const [draft, setDraft] = useState("");
    const [own, setOwn] = useState<string[]>([]);

    useEffect(() => {
      let current = true;
      store?.mine().then(
        (mine) => {
          if (!current) return;
          const values = mine
            .map((response) => response.value)
            .filter((value) => typeof value === "string");
          setOwn(values as string[]);
          if (!data.multiple && typeof values.at(-1) === "string")
            setDraft(values.at(-1) as string);
        },
        () => {},
      );
      return () => {
        current = false;
      };
    }, [store, data.multiple]);

    return (
      <form
        data-activity-kind="text"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (!value) return;
          setOwn(data.multiple ? [...own, value] : [value]);
          if (data.multiple) setDraft("");
          store?.write(value, { multiple: data.multiple }).catch(() => {});
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <label htmlFor={`text-${data.id}`} style={{ fontSize: 20 }}>
          {data.prompt}
        </label>
        <input
          id={`text-${data.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{
            fontSize: 20,
            padding: 12,
            borderRadius: `var(${cssVariable("radius", "small")})`,
            border: `1px solid ${color("border")}`,
            background: color("surface"),
            color: color("text"),
          }}
        />
        <button type="submit" style={{ fontSize: 20, padding: 12 }}>
          {strings("basics.activity.send")}
        </button>
        {own.length > 0 && (
          <ul data-own style={{ margin: 0, color: color("textMuted") }}>
            {own.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        )}
      </form>
    );
  },
  Monitor: ({ data }) => {
    const strings = useText();
    const count = useResponses(data.id).length;
    return (
      <span data-monitor="text" data-count={count}>
        {strings("basics.monitor.answers", { count })}
      </span>
    );
  },
});

/** A message on the phones while nothing is asked, e.g. "watch the stage" (spec §6.4). */
export const wait = defineActivity({
  type: "wait",
  schema: z.object({ id: z.string(), text: z.string().min(1), ...activityMeta }),
  Participant: ({ data }) => (
    <p data-activity-kind="wait" style={{ fontSize: 20 }}>
      {data.text}
    </p>
  ),
});

/** A call to action with a link: the generalized "write us a mail" (spec §6.4). */
export const link = defineActivity({
  type: "link",
  schema: z.object({
    id: z.string(),
    url: z.string().url(),
    label: z.string().min(1),
    /** One line of context above the button. */
    hint: z.string().optional(),
    /** What happens with what the link collects, in one line. */
    privacy: z.string().optional(),
    ...activityMeta,
  }),
  Participant: ({ data }) => (
    <div data-activity-kind="link" style={{ display: "grid", gap: 12 }}>
      {data.hint && <p style={{ fontSize: 20, margin: 0 }}>{data.hint}</p>}
      <a
        href={data.url}
        rel="noreferrer noopener"
        target="_blank"
        style={{
          fontSize: 20,
          padding: 14,
          textAlign: "center",
          borderRadius: `var(${cssVariable("radius", "small")})`,
          background: color("primary"),
          color: color("onPrimary"),
          textDecoration: "none",
        }}
      >
        {data.label}
      </a>
      {data.privacy && (
        <p data-privacy style={{ fontSize: 16, color: color("textMuted"), margin: 0 }}>
          {data.privacy}
        </p>
      )}
    </div>
  ),
});
