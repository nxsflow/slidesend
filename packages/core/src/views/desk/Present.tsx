/**
 * The desk is deliberately not themeable beyond the chapter accents (spec §2), so its own
 * colours are literal here: slidesend-allow-literal-styles.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { typedClient } from "../../client/client";
import type { Presentation } from "../../deck/presentation";
import { accentVariable, accentVariableAt } from "../../design/tokens";
import type { PlatformClient } from "../../platform/contract";
import type { CoreApi } from "../../server/runtime";
import type { AdoptedPlan, Presence } from "../../sessions/runtime-types";
import type { Session } from "../../sessions/types";
import { positionOf, stageFit, stepIndexOf } from "../../stage/navigation";
import { type CursorTransport, hostedTransport } from "../../sync/transport";
import { ActivityHost } from "../ActivityHost";
import { usePresentation, useText } from "../context";
import { deviceId } from "../device";
import { useNavigation } from "../hooks";
import { StageSurface, stageSurfaceStyle } from "../Stage";
import { SessionContext } from "../session-context";
import { formatDuration, talkClock } from "./clock";
import { startMinutesAt } from "./timings";

/**
 * Presenting happens in a dark room, so this view is dark: quiet surfaces, hairlines instead of
 * cards, and the large type reserved for what the speaker reads aloud.
 */
const dark = {
  page: "#0f141a",
  panel: "#151b23",
  line: "#252d39",
  text: "#f3f3f7",
  soft: "#b4b4bb",
  muted: "#8c8c94",
  cue: "#ffbb45",
  danger: "#ff6a3d",
};
const toneColor = { ahead: "#00e582", onTime: "#ffbb45", behind: "#ff9a3d", late: "#ff6a3d" };
const accent = `var(${accentVariable})`;

const label = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: dark.muted,
  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

const button = {
  fontSize: 15,
  padding: "10px 16px",
  borderRadius: 10,
  border: `1px solid ${dark.line}`,
  background: dark.panel,
  color: dark.text,
  cursor: "pointer",
} as const;

/** Props of `PresentTab`. */
export interface PresentTabProps {
  platform: PlatformClient;
  secret: string;
  session: Session;
  presence?: Presence;
  /** How the audience joins this session. */
  join?: { kind: Session["kind"]; joinPath: string };
  /** Opens the stage window, already authorized. */
  openStage(): void;
  /** Back to the start page; the session keeps running. */
  onBack(): void;
  /** Gives an open session more time before it closes on its own. */
  onExtend(minutes: number): void;
  /** Ends the session; for a rehearsal, whether its measured times are kept (spec §13). */
  onEnd(keepTimings: boolean): Promise<void>;
}

/** A stage surface scaled into whatever room it gets. */
function Preview({ index, label: name }: { index: number; label: string }) {
  const presentation = usePresentation();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height: 270 });

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      data-preview={name}
      // A picture of the stage: it is read out, not operated.
      role="img"
      aria-label={name}
      style={{
        position: "relative",
        overflow: "hidden",
        aspectRatio: "16 / 9",
        borderRadius: 8,
        border: `1px solid ${dark.line}`,
        ...stageSurfaceStyle(presentation, index),
      }}
    >
      <StageSurface index={index} fit={stageFit(size.width, size.height)} interactive={false} />
    </div>
  );
}

/** The jump overlay: every slide, grouped by chapter, closing after the jump (spec §12). */
function Jump({
  presentation,
  current,
  onJump,
  onClose,
}: {
  presentation: Presentation;
  current: number;
  onJump(index: number): void;
  onClose(): void;
}) {
  const text = useText();
  return (
    <div
      data-jump
      role="dialog"
      aria-label={text("core.desk.present.jumpTitle")}
      style={{
        position: "fixed",
        inset: "5vh 5vw",
        background: dark.panel,
        border: `1px solid ${dark.line}`,
        borderRadius: 14,
        padding: 24,
        overflow: "auto",
        zIndex: 10,
        display: "grid",
        gap: 20,
        alignContent: "start",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20 }}>{text("core.desk.present.jumpTitle")}</h2>
      {presentation.chapters.map((chapter, chapterIndex) => (
        <section key={chapter.id} style={{ display: "grid", gap: 8 }}>
          <h3
            style={{
              ...label,
              color: `var(${accentVariableAt((chapterIndex % presentation.design.tokens.base.accents.length) + 1)})`,
            }}
          >
            {chapter.title}
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presentation.slides
              .filter((slide) => slide.chapter === chapter.id)
              .map((slide) => {
                const here =
                  current >= slide.firstStep && current < slide.firstStep + slide.stepCount;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    data-jump-to={slide.id}
                    onClick={() => onJump(slide.firstStep)}
                    style={{
                      ...button,
                      borderColor: here ? accent : dark.line,
                      fontWeight: here ? 650 : 400,
                    }}
                  >
                    {slide.label}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
      <button type="button" onClick={onClose} style={{ ...button, justifySelf: "start" }}>
        {text("core.desk.present.close")}
      </button>
    </div>
  );
}

/** The join address with its QR code, so the speaker can point at it or read it out. */
function Join({ path }: { path: string }) {
  const text = useText();
  const url = `${window.location.origin}${path}`;
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    let current = true;
    import("qrcode").then(
      ({ default: qrcode }) =>
        qrcode
          .toDataURL(url, { margin: 1, width: 160, color: { dark: "#0f141a", light: "#f3f3f7" } })
          .then((image) => current && setQr(image))
          .catch(() => {}),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [url]);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {qr && <img src={qr} alt="" width={80} height={80} style={{ borderRadius: 6 }} />}
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <p style={label}>{text("core.desk.present.join")}</p>
        <a data-join href={url} style={{ color: dark.soft, wordBreak: "break-all", fontSize: 14 }}>
          {url}
        </a>
      </div>
    </div>
  );
}

/**
 * The speaker's view while presenting (spec §12, amended 2026-10-03), modelled on the operator
 * view the tool was extracted from: the notes take the wide right column in large type, the
 * previews and the room sit on the left, the clock in the header, the controls in a bar that
 * never scrolls away. Nothing here destroys data; ending the session leads to its review.
 */
export function PresentTab({
  platform,
  secret,
  session,
  presence,
  join,
  openStage,
  onBack,
  onExtend,
  onEnd,
}: PresentTabProps) {
  const text = useText();
  const presentation = usePresentation();
  const [transport, setTransport] = useState<CursorTransport>();
  const [jumping, setJumping] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [ending, setEnding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [plan, setPlan] = useState<AdoptedPlan>();
  const lastMove = useRef<Parameters<CursorTransport["send"]>[0]>(undefined);
  const stageBox = useRef<HTMLDivElement>(null);

  // The plan a rehearsal adopted, read once: it only changes in the review.
  useEffect(() => {
    typedClient<CoreApi>(platform)
      .planGet(secret)
      .then(
        (found) => setPlan(found ?? undefined),
        () => {},
      );
  }, [platform, secret]);

  const navigation = useNavigation(presentation, {
    canSteer: true,
    onMove(index) {
      const { slide, step } = positionOf(presentation, index);
      const target = { index, slideId: slide.id, step };
      lastMove.current = target;
      transport?.send(target);
    },
  });
  const { receive, goto } = navigation;

  // biome-ignore lint/correctness/useExhaustiveDependencies: one transport per session
  useEffect(() => {
    const created = hostedTransport({ platform, sessionId: session.id, secret });
    setTransport(created);
    if (lastMove.current) created.send(lastMove.current);
    const stop = created.onCursor((cursor) => {
      receive(stepIndexOf(presentation, cursor.slideId, cursor.step) ?? cursor.index);
    });
    return () => {
      stop();
      created.close();
    };
  }, [platform, session.id, secret]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }
      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        setJumping((open) => !open);
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcuts((open) => !open);
      } else if (event.key === "Escape") {
        setJumping(false);
        setShortcuts(false);
        setEnding(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const step = presentation.steps[navigation.index];
  const chapterIndex = presentation.chapters.findIndex((chapter) => chapter.id === step?.chapter);
  const chapter = presentation.chapters[chapterIndex];
  const clock = talkClock({
    ...(session.startedAt !== undefined ? { startedAt: session.startedAt } : {}),
    now,
    // An adopted plan wins over the deck's minutes (spec §13), so the mark the clock measures
    // against moves with it.
    plannedMinutes: startMinutesAt(presentation, navigation.index, plan),
  });
  const activity = step?.activity;
  const monitorDefinition = activity ? presentation.registry.definition(activity.type) : undefined;
  const Monitor = monitorDefinition?.group === "activity" ? monitorDefinition.Monitor : undefined;
  const stages = presence?.stages.length ?? 0;
  const phones = presence?.phones ?? 0;
  const last = navigation.index >= presentation.steps.length - 1;
  const jump = useCallback(
    (index: number) => {
      goto(index);
      setJumping(false);
    },
    [goto],
  );
  const chapterAccentVariable =
    chapterIndex >= 0
      ? `var(${accentVariableAt((chapterIndex % presentation.design.tokens.base.accents.length) + 1)})`
      : accent;

  return (
    <div
      data-present
      data-session-id={session.id}
      style={{
        minHeight: "100dvh",
        background: dark.page,
        color: dark.text,
        display: "grid",
        gridTemplateRows: "auto auto 1fr auto",
      }}
    >
      <header
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 24px",
          borderBottom: `1px solid ${dark.line}`,
        }}
      >
        <button type="button" data-back onClick={onBack} style={{ ...button, padding: "6px 12px" }}>
          ← {text("core.desk.present.back")}
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 220 }}>
          <span
            style={{ width: 10, height: 10, borderRadius: 999, background: chapterAccentVariable }}
          />
          <span data-chapter style={{ fontSize: 17, fontWeight: 650 }}>
            {chapter?.title}
          </span>
          {step?.label && step.label !== chapter?.title && (
            <span data-slide-label style={{ color: dark.muted }}>
              · {step.label}
            </span>
          )}
        </div>
        <span
          data-position
          style={{
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 22,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {text("core.desk.present.position", {
            step: navigation.index + 1,
            total: presentation.steps.length,
          })}
        </span>
        <span
          data-clock
          data-tone={clock.tone}
          style={{ display: "grid", justifyItems: "end", fontVariantNumeric: "tabular-nums" }}
        >
          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 22 }}>
            {formatDuration(clock.elapsedMs)}{" "}
            <span style={{ color: toneColor[clock.tone], fontSize: 16 }}>
              {formatDuration(clock.deltaMs, true)}
            </span>
          </span>
          <span style={{ color: dark.muted, fontSize: 12 }}>
            {clock.started
              ? text("core.desk.present.planned", { time: formatDuration(clock.plannedMs) })
              : text("core.desk.present.notStarted")}
          </span>
        </span>
        <span data-status style={{ display: "grid", justifyItems: "end", gap: 2, fontSize: 13 }}>
          <span
            style={{
              ...label,
              color: session.kind === "live" ? dark.danger : dark.cue,
              fontSize: 12,
            }}
          >
            {session.kind === "live" ? "● " : ""}
            {text(`core.desk.sessions.${session.kind}`)}
          </span>
          <span style={{ color: dark.soft }}>
            {text("core.desk.presence.stages", { count: stages })} ·{" "}
            {text("core.desk.presence.phones", { count: phones })}
            {session.closesAt
              ? ` · ${text("core.desk.sessions.closesAt", {
                  time: new Date(session.closesAt).toLocaleTimeString(undefined, {
                    timeStyle: "short",
                  }),
                })}`
              : ""}
          </span>
        </span>
        <button
          type="button"
          data-extend
          onClick={() => onExtend(10)}
          style={{ ...button, padding: "6px 10px", fontSize: 13 }}
        >
          {text("core.desk.present.extend")}
        </button>
      </header>

      {stages === 0 ? (
        <div
          data-no-stage
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            padding: "10px 24px",
            background: "#3a2a12",
            borderBottom: `1px solid ${dark.line}`,
          }}
        >
          <span style={{ flex: 1 }}>{text("core.desk.present.noStage")}</span>
          <button
            type="button"
            data-open-stage
            onClick={openStage}
            style={{
              ...button,
              background: dark.cue,
              color: dark.page,
              border: "none",
              fontWeight: 650,
            }}
          >
            {text("core.desk.present.openStage")}
          </button>
        </div>
      ) : (
        <div />
      )}

      <div
        style={{
          display: "grid",
          gap: 28,
          padding: "20px 24px",
          gridTemplateColumns: "minmax(280px, 2fr) minmax(0, 3fr)",
          alignItems: "start",
          minHeight: 0,
        }}
      >
        <SessionContext.Provider
          // The previews are this session's stage: its join code, its live results.
          value={{
            sessionId: session.id,
            kind: session.kind,
            ...(join ? { joinPath: join.joinPath } : {}),
            hosted: true,
            platform,
          }}
        >
          <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <div ref={stageBox} style={{ display: "grid", gap: 6 }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <p style={label}>{text("core.desk.present.now")}</p>
                <button
                  type="button"
                  data-fullscreen
                  onClick={() => void stageBox.current?.requestFullscreen?.().catch(() => {})}
                  style={{ ...button, padding: "4px 10px", fontSize: 12 }}
                >
                  {text("core.desk.present.fullscreen")}
                </button>
              </div>
              <Preview index={navigation.index} label={text("core.desk.present.now")} />
            </div>
            <div style={{ display: "grid", gap: 6, maxWidth: "60%" }}>
              <p style={label}>{text("core.desk.present.next")}</p>
              {last ? (
                <p style={{ margin: 0, color: dark.muted }}>{text("core.desk.present.last")}</p>
              ) : (
                <Preview index={navigation.index + 1} label={text("core.desk.present.next")} />
              )}
            </div>
            <div
              data-phones
              style={{
                display: "grid",
                gap: 8,
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${dark.line}`,
                background: dark.panel,
              }}
            >
              <p style={label}>{text("core.desk.present.phones", { count: phones })}</p>
              {activity ? (
                <div data-monitor-for={String((activity as { id?: string }).id ?? activity.type)}>
                  {Monitor ? (
                    <ActivityHost
                      node={activity}
                      sessionId={session.id}
                      deviceId={deviceId()}
                      platform={platform}
                      monitor
                    />
                  ) : (
                    <p style={{ margin: 0 }}>
                      {String((activity as { id?: string }).id ?? activity.type)}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, color: dark.muted }}>
                  {text("core.desk.present.noActivity")}
                </p>
              )}
              {join && <Join path={join.joinPath} />}
            </div>
          </div>
        </SessionContext.Provider>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {step?.cue && (
            <p
              data-cue
              style={{
                margin: 0,
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                padding: "12px 16px",
                borderRadius: 10,
                border: `1px solid ${dark.cue}`,
                color: dark.cue,
                fontSize: 20,
              }}
            >
              <span style={{ ...label, color: dark.cue }}>{text("core.desk.present.cue")}</span>
              {step.cue}
            </p>
          )}
          <p style={label}>{text("core.desk.present.notes")}</p>
          <div
            data-notes
            style={{ fontSize: 28, lineHeight: 1.45, whiteSpace: "pre-wrap", maxWidth: "48ch" }}
          >
            {step?.notes ?? (
              <span style={{ color: dark.muted, fontSize: 20 }}>
                {text("core.desk.present.noNotes")}
              </span>
            )}
          </div>
        </div>
      </div>

      <footer
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px 24px",
          borderTop: `1px solid ${dark.line}`,
          background: dark.page,
        }}
      >
        <button
          type="button"
          data-previous
          onClick={navigation.previous}
          style={{ ...button, fontSize: 18, padding: "12px 22px" }}
        >
          ← {text("core.desk.present.previous")}
        </button>
        <button type="button" data-jump-open onClick={() => setJumping(true)} style={button}>
          {text("core.desk.present.jump")} · G
        </button>
        <button
          type="button"
          data-shortcuts
          onClick={() => setShortcuts((open) => !open)}
          style={button}
        >
          ?
        </button>
        <span style={{ flex: 1 }} />
        {ending ? (
          <span
            data-ending
            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            <span style={{ color: dark.soft }}>
              {session.kind === "rehearsal"
                ? text("core.desk.review.timed", { session: session.name })
                : text("core.desk.present.endLive")}
            </span>
            {session.kind === "rehearsal" ? (
              <>
                <button
                  type="button"
                  data-close-timed
                  style={button}
                  onClick={() => void onEnd(true)}
                >
                  {text("core.desk.review.timedYes")}
                </button>
                <button
                  type="button"
                  data-close-untimed
                  style={button}
                  onClick={() => void onEnd(false)}
                >
                  {text("core.desk.review.timedNo")}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-close-confirm
                style={{ ...button, borderColor: dark.danger, color: dark.danger }}
                onClick={() => void onEnd(true)}
              >
                {text("core.desk.present.endConfirm")}
              </button>
            )}
            <button type="button" style={button} onClick={() => setEnding(false)}>
              {text("core.desk.present.endCancel")}
            </button>
          </span>
        ) : (
          <button type="button" data-close style={button} onClick={() => setEnding(true)}>
            {text("core.desk.present.end")}
          </button>
        )}
        <button
          type="button"
          data-next
          onClick={navigation.next}
          style={{
            ...button,
            fontSize: 18,
            padding: "12px 28px",
            background: dark.text,
            color: dark.page,
            border: "none",
            fontWeight: 650,
          }}
        >
          {text("core.desk.present.next")} →
        </button>
      </footer>

      {jumping && (
        <Jump
          presentation={presentation}
          current={navigation.index}
          onJump={jump}
          onClose={() => setJumping(false)}
        />
      )}
      {shortcuts && (
        <div
          data-shortcut-list
          style={{
            position: "fixed",
            left: 24,
            bottom: 80,
            padding: 14,
            borderRadius: 10,
            border: `1px solid ${dark.line}`,
            background: dark.panel,
            zIndex: 10,
          }}
        >
          <p style={{ margin: 0 }}>{text("core.desk.present.shortcuts")}</p>
        </div>
      )}
    </div>
  );
}
