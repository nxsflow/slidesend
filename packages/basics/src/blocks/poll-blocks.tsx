import {
  type ActivityNode,
  activityById,
  activityRef,
  cssVariable,
  defineBlock,
  type NodeSchema,
  usePresentation,
  useResponses,
  useText,
} from "@slidesend/core";
import { z } from "zod";
import { countAnswers, countMatrix, poll, pollQuestions } from "../activities/poll";
import { qrField, WithJoinQr } from "./join-qr";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/**
 * A block that shows a poll may define it inline — then it contributes the activity to its own
 * step — or point at one asked elsewhere with `of` (spec §6.5).
 */
const pollSource = {
  /** The id of a poll asked on another step. */
  of: activityRef().optional(),
  /** An inline poll: its id … */
  id: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .optional(),
  /** … and its questions. */
  questions: pollQuestions.optional(),
  /** One sentence of context for the phones, for an inline poll. */
  message: z.string().optional(),
};

const oneSource = (
  data: { of?: string; id?: string; questions?: unknown },
  context: z.RefinementCtx,
) => {
  const inline = Boolean(data.id && data.questions);
  if (inline === Boolean(data.of)) {
    context.addIssue({
      code: "custom",
      message: "Either point at a poll with `of`, or define one here with `id` and `questions`.",
    });
  }
};

/** The poll a block shows: its own, or the one it points at. */
function usePollNode(data: { of?: string; id?: string; questions?: unknown }) {
  const presentation = usePresentation();
  const id = data.of ?? data.id;
  const referenced = data.of ? activityById(presentation, data.of) : undefined;
  const node = (data.of ? referenced : (data as unknown as ActivityNode)) as
    | (ActivityNode & { questions?: z.infer<typeof pollQuestions> })
    | undefined;
  return { id, questions: node?.questions ?? [] };
}

const describeInline = (data: {
  of?: string;
  id?: string;
  questions?: z.infer<typeof pollQuestions>;
  message?: string;
}) =>
  data.of || !data.id || !data.questions
    ? [{}]
    : [
        {
          activity: poll({
            id: data.id,
            questions: data.questions,
            ...(data.message ? { message: data.message } : {}),
          }),
        },
      ];

const schemaOf = (shape: Record<string, z.ZodTypeAny>): NodeSchema =>
  z.object({ ...pollSource, ...shape }).superRefine(oneSource) as unknown as NodeSchema;

const axesSchema = z
  .object({
    /** The caption above the columns, i.e. the second question; defaults to its `short`. */
    x: z.string().min(1).optional(),
    /** The caption beside the rows, i.e. the first question; defaults to its `short`. */
    y: z.string().min(1).optional(),
  })
  .optional();

/**
 * Two questions counted against each other, one cell per participant (spec §6.5): the first
 * question's options are the rows, the second's the columns, each axis with its caption, the
 * grid centered and as large as the panel allows.
 */
export const pollMatrix = defineBlock({
  type: "pollMatrix",
  schema: schemaOf({ axes: axesSchema, ...qrField }),
  describe: (data) => ({ label: "poll", steps: describeInline(data) }),
  Component: ({ data }) => {
    const text = useText();
    const { id, questions } = usePollNode(data);
    const responses = useResponses(id);
    const [rows, columns] = questions;
    if (!rows || !columns) {
      return <p data-block="pollMatrix">{text("basics.poll.needsTwo")}</p>;
    }
    const axes = (data as { axes?: z.infer<typeof axesSchema> }).axes;
    const { cells, answered } = countMatrix(responses, rows.id, columns.id);
    const most = Math.max(1, ...Object.values(cells).flatMap((row) => Object.values(row)));
    const largest = Math.max(columns.options.length, rows.options.length);
    const cell = largest <= 2 ? 190 : largest <= 3 ? 160 : 124;
    const caption = {
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: "0.04em",
      color: color("textMuted"),
    } as const;
    const label = { fontSize: 36, fontWeight: 600, padding: "0 20px" } as const;
    return (
      <WithJoinQr show={(data as { qr?: boolean }).qr ?? false}>
        <div
          data-block="pollMatrix"
          data-answered={answered}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
        >
          <table style={{ borderCollapse: "separate", borderSpacing: 12 }}>
            <thead>
              <tr>
                <td colSpan={2} />
                <th
                  data-axis="x"
                  scope="colgroup"
                  colSpan={columns.options.length}
                  style={{ ...caption, paddingBottom: 4 }}
                >
                  {axes?.x ?? columns.short ?? columns.text}
                </th>
              </tr>
              <tr>
                <td colSpan={2} />
                {columns.options.map((option) => (
                  <th key={option.id} scope="col" style={{ ...label, padding: "0 0 4px" }}>
                    {option.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.options.map((row, index) => (
                <tr key={row.id}>
                  {index === 0 && (
                    <th
                      data-axis="y"
                      scope="rowgroup"
                      rowSpan={rows.options.length}
                      style={{
                        ...caption,
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        padding: "0 4px",
                      }}
                    >
                      {axes?.y ?? rows.short ?? rows.text}
                    </th>
                  )}
                  <th scope="row" style={{ ...label, textAlign: "right" }}>
                    {row.label}
                  </th>
                  {columns.options.map((column) => {
                    const count = cells[row.id]?.[column.id] ?? 0;
                    return (
                      <td
                        key={column.id}
                        data-cell={`${row.id}/${column.id}`}
                        style={{
                          width: cell,
                          height: cell,
                          textAlign: "center",
                          fontSize: 56,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          borderRadius: `var(${cssVariable("radius", "large")})`,
                          border: `2px solid ${color("border")}`,
                          color: count > 0 ? color("text") : color("textMuted"),
                          background:
                            count > 0
                              ? `color-mix(in oklab, var(--slidesend-accent) ${Math.round(25 + (count / most) * 55)}%, transparent)`
                              : "transparent",
                          transition: "background 400ms ease-out",
                        }}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 28, color: color("textMuted"), margin: "12px 0 0" }}>
            {text("basics.poll.answered", { count: answered })}
          </p>
        </div>
      </WithJoinQr>
    );
  },
});

/** The answers of a poll as a list of bars, one block per question. */
export const pollList = defineBlock({
  type: "pollList",
  schema: schemaOf({ ...qrField }),
  describe: (data) => ({ label: "poll", steps: describeInline(data) }),
  Component: ({ data }) => {
    const text = useText();
    const { id, questions } = usePollNode(data);
    const responses = useResponses(id);
    return (
      <WithJoinQr show={(data as { qr?: boolean }).qr ?? false}>
        <div data-block="pollList" style={{ display: "grid", gap: 40, fontSize: 36 }}>
          {questions.map((question) => {
            const counts = countAnswers(responses, question.id);
            const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
            return (
              <section key={question.id} data-question={question.id}>
                <h3 style={{ fontSize: 40, margin: "0 0 16px" }}>
                  {question.short ?? question.text}
                </h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {question.options.map((option) => {
                    const count = counts[option.id] ?? 0;
                    return (
                      <div key={option.id} data-option={option.id} data-count={count}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{option.label}</span>
                          <span style={{ color: color("textMuted") }}>{count}</span>
                        </div>
                        <div style={{ background: color("border"), height: 16, borderRadius: 8 }}>
                          <div
                            style={{
                              width: `${total ? (count / total) * 100 : 0}%`,
                              height: "100%",
                              borderRadius: 8,
                              background: "var(--slidesend-accent)",
                              transition: "width 400ms ease-out",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p style={{ fontSize: 28, color: color("textMuted"), margin: 0 }}>
            {text("basics.poll.answered", { count: responses.length })}
          </p>
        </div>
      </WithJoinQr>
    );
  },
});
