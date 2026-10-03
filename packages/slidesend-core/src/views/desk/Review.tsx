/**
 * The Review tab (spec §12): what a rehearsal was worth, per session.
 *
 * The desk is deliberately not themeable beyond the chapter accents (spec §2), so its own
 * colours are literal here: slidesend-allow-literal-styles.
 *
 * Two exits, both deliberate: adopt the measurement as the plan, or copy a prompt an agent can
 * read. Nothing is adopted by itself. This tab also holds the only destructive function in the
 * whole tool, and it holds it alone.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { typedClient } from "../../client/client";
import type { PlatformClient } from "../../platform/contract";
import type { CoreApi } from "../../server/runtime";
import type { AdoptedPlan, StepTiming } from "../../sessions/runtime-types";
import type { Session } from "../../sessions/types";
import { usePresentation, useText } from "../context";
import {
  adoptPlan,
  analysisPrompt,
  asClock,
  planApplies,
  type ReviewRow,
  reviewRows,
  reviewTotals,
} from "./timings";

const border = "1px solid #d8d9d4";
const muted = "#5d616b";

const button = {
  font: "inherit",
  fontSize: 15,
  padding: "8px 10px",
  borderRadius: 8,
  border,
  background: "#ffffff",
  cursor: "pointer",
} as const;

/** "2:30" and "150" both mean 150 seconds; anything else means none. */
export function secondsFrom(text: string): number {
  const clock = /^(\d{1,3}):(\d{1,2})$/.exec(text.trim());
  if (clock) return Number(clock[1]) * 60 + Math.min(59, Number(clock[2]));
  const plain = /^(\d{1,4})$/.exec(text.trim());
  return plain ? Number(plain[1]) : 0;
}

/** Props of `ReviewTab`. */
export interface ReviewTabProps {
  platform: PlatformClient;
  secret: string;
  session: Session;
  /** Called when the session's data was deleted, so the desk can reload its sessions. */
  onChanged(): void;
}

/**
 * Review of one session: the table of planned against measured, the two exits, the export, and
 * the deletion.
 */
export function ReviewTab({ platform, secret, session, onChanged }: ReviewTabProps) {
  const presentation = usePresentation();
  const text = useText();
  const api = useMemo(() => typedClient<CoreApi>(platform), [platform]);
  const [timings, setTimings] = useState<StepTiming[]>([]);
  const [estimates, setEstimates] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<AdoptedPlan>();
  const [note, setNote] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    api.timingsList(secret, session.id).then(setTimings, () => {});
    api.planGet(secret).then(
      (found) => setPlan(found ?? undefined),
      () => {},
    );
  }, [api, secret, session.id]);
  useEffect(load, [load]);

  const rows = reviewRows(presentation, timings, estimates);
  const totals = reviewTotals(rows);
  const targetMinutes = session.plannedMinutes;
  const measured = rows.filter((row) => row.visits > 0);
  const applies = planApplies(plan, presentation);

  const adopt = async () => {
    const next = adoptPlan(presentation, rows, session.id);
    await api.planAdopt(secret, next);
    setPlan(next);
    setNote(text("core.desk.review.adopted"));
  };

  const copyPrompt = async () => {
    const prompt = analysisPrompt(presentation, rows, targetMinutes);
    try {
      await navigator.clipboard.writeText(prompt);
      setNote(text("core.desk.review.copied"));
    } catch {
      // A browser that refuses the clipboard is not a reason to lose the prompt.
      setNote(prompt);
    }
  };

  const exportData = async () => {
    const data = await api.sessionExport(secret, session.id);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.name.replace(/\W+/g, "-").toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNote(text("core.desk.review.exported", { responses: data.responses.length }));
  };

  const deleteData = async () => {
    try {
      const deleted = await api.sessionDeleteData(secret, session.id);
      // Verified by listing rather than announced: the count comes from what is gone.
      const left = await api.timingsList(secret, session.id);
      setTimings(left);
      setNote(text("core.desk.review.deleted", { keys: deleted, left: left.length }));
      onChanged();
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    }
    setConfirming(false);
  };

  return (
    <section data-review data-session={session.id} style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>
          {text("core.desk.review.title", { session: session.name })}
        </h2>
        <span style={{ color: muted }}>
          {text("core.desk.review.totals", {
            planned: asClock(totals.plannedMs),
            measured: asClock(totals.measuredMs),
            audience: asClock(totals.audienceMs),
            total: asClock(totals.totalMs),
            target: targetMinutes,
          })}
        </span>
      </header>

      {measured.length === 0 ? (
        <p data-empty style={{ margin: 0, color: muted }}>
          {text("core.desk.review.empty")}
        </p>
      ) : (
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: muted }}>
              <th style={{ padding: "4px 8px" }}>{text("core.desk.review.column.step")}</th>
              <th style={{ padding: "4px 8px" }}>{text("core.desk.review.column.planned")}</th>
              <th style={{ padding: "4px 8px" }}>{text("core.desk.review.column.measured")}</th>
              <th style={{ padding: "4px 8px" }}>{text("core.desk.review.column.audience")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row
                key={row.key}
                row={row}
                onEstimate={(seconds) => setEstimates((all) => ({ ...all, [row.key]: seconds }))}
              />
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          data-adopt
          style={button}
          onClick={adopt}
          disabled={measured.length === 0}
        >
          {text("core.desk.review.adopt")}
        </button>
        <button
          type="button"
          data-copy
          style={button}
          onClick={copyPrompt}
          disabled={measured.length === 0}
        >
          {text("core.desk.review.copy")}
        </button>
        <button type="button" data-export style={button} onClick={exportData}>
          {text("core.desk.review.export")}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              data-delete-confirm
              style={{ ...button, borderColor: "#c2372b", color: "#c2372b" }}
              onClick={deleteData}
            >
              {text("core.desk.review.deleteConfirm", { session: session.name })}
            </button>
            <button
              type="button"
              data-delete-cancel
              style={button}
              onClick={() => setConfirming(false)}
            >
              {text("core.desk.review.deleteCancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            data-delete
            style={{ ...button, color: "#c2372b" }}
            onClick={() => setConfirming(true)}
          >
            {text("core.desk.review.delete")}
          </button>
        )}
      </div>

      {plan && (
        <p data-plan data-lapsed={!applies || undefined} style={{ margin: 0, color: muted }}>
          {applies
            ? text("core.desk.review.plan", {
                when: new Date(plan.adoptedAt).toLocaleString(),
              })
            : text("core.desk.review.planLapsed")}{" "}
          <button
            type="button"
            data-plan-clear
            style={{ ...button, padding: "2px 8px", fontSize: 13 }}
            onClick={async () => {
              await api.planClear(secret);
              setPlan(undefined);
            }}
          >
            {text("core.desk.review.planClear")}
          </button>
        </p>
      )}
      {note && (
        <p data-note style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {note}
        </p>
      )}
    </section>
  );
}

/** One step of the deck. Only a step with an activity offers an estimate, and only it needs one. */
function Row({ row, onEstimate }: { row: ReviewRow; onEstimate(seconds: number): void }) {
  const text = useText();
  const [draft, setDraft] = useState("");
  const cell = { padding: "4px 8px", borderTop: border } as const;
  return (
    <tr
      data-row={row.key}
      data-flagged={row.flagged || undefined}
      data-reached={row.visits > 0 || undefined}
    >
      <td style={cell}>
        {row.index + 1} · {row.label}
        {row.visits > 1 && (
          <span style={{ color: muted }}>
            {" "}
            {text("core.desk.review.visits", { visits: row.visits })}
          </span>
        )}
      </td>
      <td style={cell}>{asClock(row.plannedMs)}</td>
      <td style={{ ...cell, fontWeight: row.flagged ? 600 : 400 }}>
        {row.visits > 0 ? asClock(row.measuredMs) : "—"}
        {row.flagged && <span title={text("core.desk.review.flagged")}> !</span>}
      </td>
      <td style={cell}>
        {row.hasActivity ? (
          <input
            data-estimate={row.key}
            value={draft}
            placeholder={text("core.desk.review.estimateHint")}
            aria-label={text("core.desk.review.column.audience")}
            onChange={(event) => {
              setDraft(event.target.value);
              onEstimate(secondsFrom(event.target.value));
            }}
            style={{
              font: "inherit",
              fontSize: 14,
              width: 64,
              padding: "2px 6px",
              borderRadius: 6,
              border,
            }}
          />
        ) : (
          <span style={{ color: muted }}>—</span>
        )}
      </td>
    </tr>
  );
}
