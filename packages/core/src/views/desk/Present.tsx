/**
 * The desk is deliberately not themeable beyond the chapter accents (spec §2), so its own
 * colours are literal here: slidesend-allow-literal-styles.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { typedClient } from "../../client/client";
import type { Presentation } from "../../deck/presentation";
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
import { formatDuration, talkClock } from "./clock";
import { startMinutesAt } from "./timings";

const border = "1px solid #d8d9d4";
const muted = "#5d616b";
const toneColor = { ahead: "#2f5bd3", onTime: "#1f8a5b", behind: "#e0a100", late: "#c2372b" };

/** Props of `PresentTab`. */
export interface PresentTabProps {
  platform: PlatformClient;
  secret: string;
  session: Session;
  presence?: Presence;
  /** Opens the stage window, already authorized. */
  openStage(): void;
}

/** A stage surface scaled into whatever room it gets. */
function Preview({ index, label }: { index: number; label: string }) {
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
      data-preview={label}
      // A picture of the stage: it is read out, not operated.
      role="img"
      aria-label={label}
      style={{
        position: "relative",
        overflow: "hidden",
        aspectRatio: "16 / 9",
        borderRadius: 10,
        border,
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
  onJump,
  onClose,
}: {
  presentation: Presentation;
  onJump(index: number): void;
  onClose(): void;
}) {
  const text = useText();
  return (
    <div
      data-jump
      role="dialog"
      aria-label={text("core.desk.present.jump")}
      style={{
        position: "fixed",
        inset: 24,
        background: "#ffffff",
        border,
        borderRadius: 12,
        padding: 20,
        overflow: "auto",
        zIndex: 10,
      }}
    >
      <h2 style={{ marginTop: 0 }}>{text("core.desk.present.jump")}</h2>
      {presentation.chapters.map((chapter) => (
        <section key={chapter.id} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px", color: muted }}>{chapter.title}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presentation.slides
              .filter((slide) => slide.chapter === chapter.id)
              .map((slide) => (
                <button
                  key={slide.id}
                  type="button"
                  data-jump-to={slide.id}
                  onClick={() => onJump(slide.firstStep)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border,
                    background: "#f7f7f4",
                    cursor: "pointer",
                  }}
                >
                  {slide.label}
                </button>
              ))}
          </div>
        </section>
      ))}
      <button
        type="button"
        onClick={onClose}
        style={{ padding: "8px 12px", borderRadius: 8, border }}
      >
        {text("core.desk.present.close")}
      </button>
    </div>
  );
}

/**
 * The Present tab (spec §12): a fixed layout with the live stage preview, what comes next, the
 * phones, the notes and the cue, the position, the clock and the status line. Nothing here
 * destroys data, and the whole tab can be operated from the keyboard.
 */
export function PresentTab({ platform, secret, session, presence, openStage }: PresentTabProps) {
  const text = useText();
  const presentation = usePresentation();
  const [transport, setTransport] = useState<CursorTransport>();
  const [jumping, setJumping] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [plan, setPlan] = useState<AdoptedPlan>();
  const lastMove = useRef<Parameters<CursorTransport["send"]>[0]>(undefined);
  const stageBox = useRef<HTMLDivElement>(null);

  // The plan a rehearsal adopted, read once: it only changes in the Review tab.
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const step = presentation.steps[navigation.index];
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
  const jump = useCallback(
    (index: number) => {
      goto(index);
      setJumping(false);
    },
    [goto],
  );

  return (
    <div data-present style={{ display: "grid", gap: 12 }}>
      <div
        style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}
      >
        <div ref={stageBox} style={{ display: "grid", gap: 8 }}>
          {stages === 0 ? (
            <div
              data-no-stage
              style={{
                display: "grid",
                gap: 12,
                placeItems: "center",
                aspectRatio: "16 / 9",
                border: "2px dashed #c2372b",
                borderRadius: 10,
                padding: 20,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0 }}>{text("core.desk.present.noStage")}</p>
              <button
                type="button"
                data-open-stage
                onClick={openStage}
                style={{ padding: "8px 12px", borderRadius: 8, border, cursor: "pointer" }}
              >
                {text("core.desk.join.openStage")}
              </button>
            </div>
          ) : (
            <Preview index={navigation.index} label={text("core.desk.present.onStage")} />
          )}
          <button
            type="button"
            data-fullscreen
            onClick={() => void stageBox.current?.requestFullscreen?.().catch(() => {})}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border,
              cursor: "pointer",
              justifySelf: "start",
            }}
          >
            {text("core.desk.present.fullscreen")}
          </button>
        </div>
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, color: muted }}>
              {text("core.desk.present.next")}
            </h3>
            <Preview
              index={Math.min(presentation.steps.length - 1, navigation.index + 1)}
              label={text("core.desk.present.next")}
            />
          </div>
          <div data-phones style={{ border, borderRadius: 10, padding: 12 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, color: muted }}>
              {text("core.desk.present.phones", { count: presence?.phones ?? 0 })}
            </h3>
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
              <p style={{ margin: 0, color: muted }}>{text("core.desk.present.noActivity")}</p>
            )}
          </div>
        </div>
      </div>

      <div
        style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}
      >
        <div
          data-notes
          style={{ border, borderRadius: 10, padding: 16, fontSize: 20, minHeight: 96 }}
        >
          {step?.notes ?? <span style={{ color: muted }}>{text("core.desk.present.noNotes")}</span>}
        </div>
        <div
          data-cue
          style={{
            border,
            borderRadius: 10,
            padding: 16,
            fontSize: 20,
            background: step?.cue ? "#fdf3d8" : undefined,
            minHeight: 96,
          }}
        >
          {step?.cue ?? <span style={{ color: muted }}>{text("core.desk.present.noCue")}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          data-previous
          onClick={navigation.previous}
          style={{ padding: "8px 14px", borderRadius: 8, border, cursor: "pointer" }}
        >
          {text("core.desk.present.previous")}
        </button>
        <button
          type="button"
          data-next
          onClick={navigation.next}
          style={{ padding: "8px 14px", borderRadius: 8, border, cursor: "pointer" }}
        >
          {text("core.desk.present.next")}
        </button>
        <span data-position>
          {text("core.desk.present.position", {
            step: navigation.index + 1,
            total: presentation.steps.length,
            slide: step?.label ?? "",
          })}
        </span>
        <button
          type="button"
          data-jump-open
          onClick={() => setJumping(true)}
          style={{ padding: "8px 14px", borderRadius: 8, border, cursor: "pointer" }}
        >
          {text("core.desk.present.jump")}
        </button>
        <button
          type="button"
          data-shortcuts
          onClick={() => setShortcuts((open) => !open)}
          style={{ padding: "8px 14px", borderRadius: 8, border, cursor: "pointer" }}
        >
          ?
        </button>
      </div>

      <p data-clock data-tone={clock.tone} style={{ margin: 0 }}>
        {text("core.desk.present.elapsed", { time: formatDuration(clock.elapsedMs) })} ·{" "}
        {text("core.desk.present.planned", { time: formatDuration(clock.plannedMs) })} ·{" "}
        <span style={{ color: toneColor[clock.tone] }}>{formatDuration(clock.deltaMs, true)}</span>
        {!clock.started && ` · ${text("core.desk.present.notStarted")}`}
      </p>

      <p data-status style={{ margin: 0, color: muted }}>
        {text(`core.desk.sessions.${session.kind}`)} ·{" "}
        {session.closesAt
          ? text("core.desk.sessions.closesAt", {
              time: new Date(session.closesAt).toLocaleTimeString(undefined, {
                timeStyle: "short",
              }),
            })
          : text(`core.desk.sessions.state.${session.state}`)}{" "}
        · {text("core.desk.presence.stages", { count: stages })} ·{" "}
        {text("core.desk.presence.phones", { count: presence?.phones ?? 0 })}
      </p>

      {jumping && (
        <Jump presentation={presentation} onJump={jump} onClose={() => setJumping(false)} />
      )}
      {shortcuts && (
        <div data-shortcut-list style={{ border, borderRadius: 10, padding: 12 }}>
          <p style={{ margin: 0 }}>{text("core.desk.present.shortcuts")}</p>
        </div>
      )}
    </div>
  );
}
