import {
  activityMeta,
  cssVariable,
  defineActivity,
  defineBlock,
  definePlugin,
  stepMeta,
  useResponseStore,
} from "@slidesend/core";
import { useEffect, useState } from "react";
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
 * A question the class answers on their phones. The example brings its own activity until the
 * basics ship theirs; it shows what an activity needs: the response store, one response per
 * device, and its own answer again after a reload.
 */
export const ask = defineActivity({
  type: "ask",
  schema: z.object({ id: z.string(), question: z.string(), ...activityMeta }),
  Participant: ({ data }) => {
    const store = useResponseStore();
    const [answer, setAnswer] = useState("");
    const [sent, setSent] = useState<string>();

    // The phone shows its own answer again when it comes back.
    useEffect(() => {
      let current = true;
      store?.mine().then(
        (mine) => {
          const own = mine.at(-1)?.value;
          if (current && typeof own === "string") {
            setSent(own);
            setAnswer(own);
          }
        },
        () => {},
      );
      return () => {
        current = false;
      };
    }, [store]);

    return (
      <form
        data-activity-form
        onSubmit={(event) => {
          event.preventDefault();
          if (!answer.trim()) return;
          setSent(answer);
          store?.write(answer).catch(() => setSent(undefined));
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <label htmlFor="answer" style={{ fontSize: 20 }}>
          {data.question}
        </label>
        <input
          id="answer"
          name="answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          style={{
            fontSize: 20,
            padding: 12,
            borderRadius: `var(${cssVariable("radius", "small")})`,
            border: `1px solid var(${cssVariable("color", "border")})`,
          }}
        />
        <button type="submit" style={{ fontSize: 20, padding: 12 }}>
          Send
        </button>
        {sent && <p data-sent>{sent}</p>}
      </form>
    );
  },
});

/** The example talk's own plugin: the nodes it needs beyond the basics. */
export const gravityPlugin = definePlugin({
  name: "gravity",
  blocks: [fact, sequence],
  activities: [ask],
});
