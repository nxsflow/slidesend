import {
  activityRef,
  cssVariable,
  defineBlock,
  useResponses,
  useText,
} from "@nxsflow/slidesend-core";
import { z } from "zod";
import { text as textActivity, textResponses } from "../activities/simple";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/**
 * The answers to a free-text question on the stage: newest first, capped, with the number of the
 * rest (spec §6.5). Defines the question inline, or points at one with `of`.
 */
export const textList = defineBlock({
  type: "textList",
  schema: z
    .object({
      of: activityRef().optional(),
      id: z
        .string()
        .regex(/^[\w-]{1,64}$/)
        .optional(),
      prompt: z.string().min(1).optional(),
      multiple: z.boolean().default(false),
      message: z.string().optional(),
      /** How many answers fit on the slide. */
      limit: z.number().int().min(1).max(40).default(8),
    })
    .superRefine((data, context) => {
      if (Boolean(data.id && data.prompt) === Boolean(data.of)) {
        context.addIssue({
          code: "custom",
          message:
            "Either point at a question with `of`, or define one here with `id` and `prompt`.",
        });
      }
    }),
  describe: (data) => ({
    label: "answers",
    steps:
      data.of || !data.id || !data.prompt
        ? [{}]
        : [
            {
              activity: textActivity({
                id: data.id,
                prompt: data.prompt,
                multiple: data.multiple,
                ...(data.message ? { message: data.message } : {}),
              }),
            },
          ],
  }),
  Component: ({ data }) => {
    const strings = useText();
    const answers = textResponses(useResponses(data.of ?? data.id));
    const shown = answers.slice(0, data.limit);
    const rest = answers.length - shown.length;
    return (
      <div data-block="textList" data-answers={answers.length} style={{ display: "grid", gap: 16 }}>
        {shown.map((answer) => (
          <p
            key={answer.key}
            data-answer
            style={{
              margin: 0,
              fontSize: 40,
              padding: 20,
              background: color("surface"),
              borderRadius: `var(${cssVariable("radius", "large")})`,
            }}
          >
            {String(answer.value)}
          </p>
        ))}
        {rest > 0 && (
          <p data-more style={{ margin: 0, fontSize: 28, color: color("textMuted") }}>
            {strings("basics.text.more", { count: rest })}
          </p>
        )}
        {answers.length === 0 && (
          <p style={{ margin: 0, fontSize: 32, color: color("textMuted") }}>
            {strings("basics.text.waiting")}
          </p>
        )}
      </div>
    );
  },
});
