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

const option = z.object({
  id: z.string().regex(/^[\w-]{1,32}$/),
  /** What the option says on the phone. */
  label: z.string().min(1),
});

/** One question of a poll: its full text for the phone, and a short label for the stage. */
export const pollQuestion = z.object({
  id: z.string().regex(/^[\w-]{1,32}$/),
  text: z.string().min(1),
  /** A short form for the axis of a matrix; defaults to the text. */
  short: z.string().min(1).optional(),
  options: z.array(option).min(2).max(8),
});

/** The questions of a poll, as blocks take them inline too. */
export const pollQuestions = z.array(pollQuestion).min(1).max(4);

/** A device's answer: the chosen option per question. */
export type PollAnswer = Record<string, string>;

/** The answers of every device that answered, by device. */
export function pollAnswers(responses: readonly ActivityResponse[]): Map<string, PollAnswer> {
  const byDevice = new Map<string, PollAnswer>();
  for (const response of responses) {
    if (typeof response.value === "object" && response.value !== null) {
      byDevice.set(response.deviceId, response.value as PollAnswer);
    }
  }
  return byDevice;
}

/** How often each option of a question was chosen. */
export function countAnswers(
  responses: readonly ActivityResponse[],
  questionId: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const answer of pollAnswers(responses).values()) {
    const chosen = answer[questionId];
    if (chosen) counts[chosen] = (counts[chosen] ?? 0) + 1;
  }
  return counts;
}

/**
 * Counts two questions against each other, per participant: a device that answered both adds one
 * to the cell of its two options (spec §6.5). `rows` and `columns` are the options in order.
 */
export function countMatrix(
  responses: readonly ActivityResponse[],
  rowQuestionId: string,
  columnQuestionId: string,
): { cells: Record<string, Record<string, number>>; answered: number } {
  const cells: Record<string, Record<string, number>> = {};
  let answered = 0;
  for (const answer of pollAnswers(responses).values()) {
    const row = answer[rowQuestionId];
    const column = answer[columnQuestionId];
    if (!row || !column) continue;
    answered++;
    cells[row] = cells[row] ?? {};
    (cells[row] as Record<string, number>)[column] =
      ((cells[row] as Record<string, number>)[column] ?? 0) + 1;
  }
  return { cells, answered };
}

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/**
 * A poll (spec §6.4): a few questions with options, answered on the phone. One answer per device;
 * answering again corrects it. It brings no server code of its own.
 */
export const poll = defineActivity({
  type: "poll",
  schema: z.object({ id: z.string(), questions: pollQuestions, ...activityMeta }),
  Participant: ({ data }) => {
    const store = useResponseStore();
    const text = useText();
    const [answer, setAnswer] = useState<PollAnswer>({});
    const [sent, setSent] = useState(false);

    useEffect(() => {
      let current = true;
      store?.mine().then(
        (mine) => {
          const own = mine.at(-1)?.value;
          if (current && typeof own === "object" && own !== null) {
            setAnswer(own as PollAnswer);
            setSent(true);
          }
        },
        () => {},
      );
      return () => {
        current = false;
      };
    }, [store]);

    const choose = (questionId: string, optionId: string) => {
      const next = { ...answer, [questionId]: optionId };
      setAnswer(next);
      setSent(true);
      store?.write(next).catch(() => setSent(false));
    };

    return (
      <div data-activity-kind="poll" style={{ display: "grid", gap: 24 }}>
        {data.questions.map((question) => (
          <fieldset key={question.id} style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 20, marginBottom: 8 }}>{question.text}</legend>
            <div style={{ display: "grid", gap: 8 }}>
              {question.options.map((choice) => {
                const chosen = answer[question.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-option={choice.id}
                    data-chosen={chosen || undefined}
                    onClick={() => choose(question.id, choice.id)}
                    style={{
                      fontSize: 20,
                      padding: 14,
                      borderRadius: `var(${cssVariable("radius", "small")})`,
                      border: `2px solid ${chosen ? color("primary") : color("border")}`,
                      background: chosen ? color("primary") : color("surface"),
                      color: chosen ? color("onPrimary") : color("text"),
                      textAlign: "left",
                    }}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {sent && <p data-sent>{text("basics.activity.saved")}</p>}
      </div>
    );
  },
  Monitor: ({ data }) => <PollMonitor id={data.id} />,
});

/** The desk's live tile: how many participants have answered (spec §12, Present). */
function PollMonitor({ id }: { id: string }) {
  const text = useText();
  const count = pollAnswers(useResponses(id)).size;
  return (
    <span data-monitor="poll" data-count={count}>
      {text("basics.monitor.answers", { count })}
    </span>
  );
}
