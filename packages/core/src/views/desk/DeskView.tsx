/**
 * The desk is deliberately not themeable beyond the chapter accents (spec §2), so its own
 * colours are literal here: slidesend-allow-literal-styles.
 */
import { useEffect, useMemo, useState } from "react";
import { chapterAccent } from "../../design/css";
import { accentVariable, accentVariableAt } from "../../design/tokens";
import type { PlatformClient } from "../../platform/contract";
import type { Session } from "../../sessions/types";
import {
  deviceLabel,
  forgetControlSecret,
  setDeviceLabel,
  storeControlSecret,
  suggestedDeviceLabel,
  takeControlSecret,
} from "../access";
import { usePresentation, useText } from "../context";
import { deviceId } from "../device";
import { PresentTab } from "./Present";
import { ReviewTab } from "./Review";
import { type Desk, deskWarnings, sortSessions, useDesk } from "./useDesk";

/** Props of `DeskView`. */
export interface DeskViewProps {
  /** The hosted platform; without one the desk runs in local mode, where there are no sessions. */
  platform?: PlatformClient;
}

/** The light palette of the start page and the review; presenting has its own, dark one. */
const light = {
  page: "#f6f5f1",
  card: "#ffffff",
  line: "#e2e0d9",
  text: "#1c1d21",
  muted: "#62656e",
  primary: "#1c1d21",
  onPrimary: "#ffffff",
  good: "#1f8a5b",
  warn: "#fdf1d6",
  bad: "#c2372b",
};

const button = {
  fontSize: 15,
  padding: "9px 14px",
  borderRadius: 10,
  border: `1px solid ${light.line}`,
  background: light.card,
  color: light.text,
  cursor: "pointer",
} as const;

const field = {
  fontSize: 15,
  padding: "9px 10px",
  borderRadius: 10,
  border: `1px solid ${light.line}`,
  background: light.card,
  color: light.text,
} as const;

/** The view the desk shows: where to begin, the talk itself, or what a session measured. */
type Stage = "start" | "present" | "review";

const when = (value: number) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const time = (value: number) =>
  new Date(value).toLocaleTimeString(undefined, { timeStyle: "short" });

/** The header of the start page and the review: the talk, and whether this desk steers it. */
function Header({ desk, onRelease, back }: { desk: Desk; onRelease(): void; back?: () => void }) {
  const text = useText();
  const presentation = usePresentation();
  const [menu, setMenu] = useState(false);
  const [label, setLabel] = useState(() => deviceLabel() || suggestedDeviceLabel());
  return (
    <header
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
        paddingBottom: 16,
        borderBottom: `1px solid ${light.line}`,
      }}
    >
      {back && (
        <button type="button" data-back style={button} onClick={back}>
          ← {text("core.desk.review.back")}
        </button>
      )}
      <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 220 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{presentation.meta.title}</h1>
        <span data-meta style={{ color: light.muted, fontSize: 14 }}>
          {text("core.desk.meta", {
            minutes: Math.round(presentation.plannedMinutes),
            steps: presentation.steps.length,
          })}
        </span>
      </div>
      <span
        data-control-state={desk.inControl ? "control" : "view-only"}
        style={{
          fontSize: 14,
          padding: "5px 10px",
          borderRadius: 999,
          background: desk.inControl ? "#e5f3ec" : light.warn,
          color: desk.inControl ? light.good : light.text,
        }}
      >
        {desk.inControl
          ? `✓ ${text("core.desk.control.badge")}`
          : text("core.desk.control.viewOnly")}
      </span>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          data-menu
          aria-expanded={menu}
          aria-label={text("core.desk.menu.open")}
          style={button}
          onClick={() => setMenu((open) => !open)}
        >
          ⋯
        </button>
        {menu && (
          <div
            data-menu-panel
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 300,
              display: "grid",
              gap: 12,
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${light.line}`,
              background: light.card,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              zIndex: 5,
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              {text("core.desk.menu.device")}
              <input
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setDeviceLabel(event.target.value);
                }}
                style={field}
              />
              <span style={{ color: light.muted, fontSize: 13 }}>
                {text("core.desk.menu.deviceHint")}
              </span>
            </label>
            {desk.inControl && (
              <div style={{ display: "grid", gap: 4 }}>
                <button
                  type="button"
                  data-release
                  style={button}
                  onClick={() => {
                    setMenu(false);
                    onRelease();
                  }}
                >
                  {text("core.desk.menu.release")}
                </button>
                <span style={{ color: light.muted, fontSize: 13 }}>
                  {text("core.desk.menu.releaseHint")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/** For a browser without the key: where the key comes from, and a field to paste it. */
function TakeControl({ desk }: { desk: Desk }) {
  const text = useText();
  const [draft, setDraft] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <section
      data-take-control
      style={{
        display: "grid",
        gap: 12,
        padding: 24,
        borderRadius: 16,
        border: `1px solid ${light.line}`,
        background: light.card,
        maxWidth: 640,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20 }}>{text("core.desk.control.title")}</h2>
      <p style={{ margin: 0, color: light.muted }}>{text("core.desk.control.explain")}</p>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={async (event) => {
          event.preventDefault();
          setWrong(!(await desk.takeControl(draft.trim())));
        }}
      >
        <input
          aria-label={text("core.desk.control.enter")}
          placeholder={text("core.desk.control.enter")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{ ...field, flex: 1, minWidth: 220 }}
        />
        <button
          type="submit"
          style={{ ...button, background: light.primary, color: light.onPrimary }}
        >
          {text("core.desk.control.save")}
        </button>
      </form>
      {wrong && (
        <p data-wrong style={{ margin: 0, color: light.bad }}>
          {text("core.desk.control.wrong")}
        </p>
      )}
    </section>
  );
}

/** One of the two big ways to begin. */
function Choice({
  kind,
  title,
  hint,
  onChoose,
  busy,
}: {
  kind: Session["kind"];
  title: string;
  hint: string;
  onChoose(): void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      data-start={kind}
      disabled={busy}
      onClick={onChoose}
      style={{
        display: "grid",
        gap: 8,
        alignContent: "start",
        textAlign: "left",
        padding: 24,
        minHeight: 150,
        borderRadius: 16,
        border: `1px solid ${kind === "live" ? light.primary : light.line}`,
        background: kind === "live" ? light.primary : light.card,
        color: kind === "live" ? light.onPrimary : light.text,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 650 }}>
        {kind === "live" ? "● " : "▶ "}
        {title}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.45, opacity: 0.8 }}>{hint}</span>
    </button>
  );
}

/** "Plan a talk for later": a start time, and the session opens by itself (spec §9, arming). */
function PlanLater({ desk }: { desk: Desk }) {
  const text = useText();
  const [kind, setKind] = useState<Session["kind"]>("live");
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  return (
    <details data-plan-later style={{ borderTop: `1px solid ${light.line}`, paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 16 }}>{text("core.desk.plan.title")}</summary>
      <p style={{ margin: "8px 0", color: light.muted }}>{text("core.desk.plan.hint")}</p>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!start) return;
          const plannedStart = new Date(start);
          void desk.plan({
            kind,
            plannedStart: plannedStart.toISOString(),
            name:
              name.trim() || text(`core.desk.name.${kind}`, { when: when(plannedStart.getTime()) }),
          });
          setName("");
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          {text("core.desk.plan.when")}
          <input
            aria-label={text("core.desk.plan.when")}
            type="datetime-local"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
            style={field}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          {text("core.desk.plan.kind")}
          <select
            aria-label={text("core.desk.plan.kind")}
            value={kind}
            onChange={(event) => setKind(event.target.value as Session["kind"])}
            style={field}
          >
            <option value="live">{text("core.desk.sessions.live")}</option>
            <option value="rehearsal">{text("core.desk.sessions.rehearsal")}</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1, minWidth: 180 }}>
          {text("core.desk.plan.name")}
          <input
            aria-label={text("core.desk.plan.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={field}
          />
        </label>
        <button type="submit" data-plan-submit style={button}>
          {text("core.desk.plan.submit")}
        </button>
      </form>
    </details>
  );
}

/** Every session of this talk, with the one thing that can be done with each. */
function History({
  desk,
  onPresent,
  onReview,
}: {
  desk: Desk;
  onPresent(id: string): void;
  onReview(id: string): void;
}) {
  const text = useText();
  const ordered = sortSessions(desk.sessions);
  if (ordered.length === 0) return null;
  return (
    <details data-history style={{ borderTop: `1px solid ${light.line}`, paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 16 }}>
        {text("core.desk.history.title", { count: ordered.length })}
      </summary>
      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
        {ordered.map((session) => (
          <li
            key={session.id}
            data-session={session.id}
            data-state={session.state}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${light.line}`,
              background: light.card,
            }}
          >
            <span style={{ flex: 1, minWidth: 200 }}>
              <strong>{session.name}</strong>
              <span style={{ color: light.muted }}>
                {" · "}
                {text(`core.desk.sessions.${session.kind}`)} ·{" "}
                {session.state === "armed" && session.opensAt
                  ? text("core.desk.sessions.opensAt", { time: when(session.opensAt) })
                  : session.state === "open" && session.closesAt
                    ? text("core.desk.sessions.closesAt", { time: time(session.closesAt) })
                    : text(`core.desk.sessions.state.${session.state}`)}
              </span>
            </span>
            {session.state === "open" && (
              <button
                type="button"
                data-present-session
                style={button}
                onClick={() => onPresent(session.id)}
              >
                {text("core.desk.history.present")}
              </button>
            )}
            {(session.state === "draft" || session.state === "armed") && (
              <button
                type="button"
                data-open
                style={button}
                onClick={async () => {
                  await desk.open(session.id);
                  onPresent(session.id);
                }}
              >
                {text("core.desk.history.open")}
              </button>
            )}
            {session.state === "armed" && (
              <button
                type="button"
                data-disarm
                style={button}
                onClick={() => desk.disarm(session.id)}
              >
                {text("core.desk.history.cancel")}
              </button>
            )}
            <button
              type="button"
              data-review-session
              style={button}
              onClick={() => onReview(session.id)}
            >
              {text("core.desk.history.review")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Where every talk begins: one click to rehearse or to go live (spec §12, amended 2026-10-03). */
function Start({
  desk,
  hosted,
  openStage,
  onPresent,
  onReview,
}: {
  desk: Desk;
  hosted: boolean;
  openStage(): void;
  onPresent(id: string): void;
  onReview(id: string): void;
}) {
  const text = useText();
  const device = useMemo(() => deviceId(), []);
  const [busy, setBusy] = useState(false);
  const running = sortSessions(desk.sessions).find((session) => session.state === "open");

  if (!hosted) {
    return (
      <section data-local style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 17 }}>{text("core.desk.start.local")}</p>
        <button
          type="button"
          data-open-stage
          style={{
            ...button,
            background: light.primary,
            color: light.onPrimary,
            justifySelf: "start",
          }}
          onClick={openStage}
        >
          {text("core.desk.start.openStage")}
        </button>
      </section>
    );
  }
  if (!desk.inControl) return <TakeControl desk={desk} />;

  const begin = async (kind: Session["kind"]) => {
    setBusy(true);
    const name = text(`core.desk.name.${kind}`, { when: when(Date.now()) });
    if (await desk.start({ kind, name })) onPresent("");
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 860 }}>
      {deskWarnings(desk, device).map((warning) => (
        <p
          key={warning.key}
          data-warning
          style={{ margin: 0, padding: 12, borderRadius: 12, background: light.warn }}
        >
          {text(warning.key, {
            ...warning.values,
            device:
              (warning.values as { device?: string }).device ||
              text("core.desk.warning.unknownDevice"),
          })}
        </p>
      ))}
      {running && (
        <section
          data-running={running.id}
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 24,
            borderRadius: 16,
            background: light.primary,
            color: light.onPrimary,
          }}
        >
          <span style={{ flex: 1, minWidth: 220, fontSize: 18 }}>
            {text("core.desk.start.running", { name: running.name })}
          </span>
          <button
            type="button"
            data-continue
            style={{ ...button, fontSize: 17, fontWeight: 600 }}
            onClick={() => onPresent(running.id)}
          >
            {text("core.desk.start.continue")} →
          </button>
        </section>
      )}
      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {text(running ? "core.desk.start.another" : "core.desk.start.title")}
        </h2>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <Choice
            kind="rehearsal"
            title={text("core.desk.start.rehearse")}
            hint={text("core.desk.start.rehearseHint")}
            busy={busy}
            onChoose={() => void begin("rehearsal")}
          />
          <Choice
            kind="live"
            title={text("core.desk.start.live")}
            hint={text("core.desk.start.liveHint")}
            busy={busy}
            onChoose={() => void begin("live")}
          />
        </div>
      </section>
      {desk.problem && (
        <p data-problem style={{ margin: 0, color: light.bad }}>
          {desk.problem}
        </p>
      )}
      <PlanLater desk={desk} />
      <History desk={desk} onPresent={onPresent} onReview={onReview} />
    </div>
  );
}

/**
 * The desk at `/desk` (spec §12, amended 2026-10-03): one flow for someone holding a talk for the
 * first time. Start offers rehearsing or going live in one click; Present is the speaker's view,
 * notes first; Review shows what a session measured once it has ended.
 */
export function DeskView({ platform }: DeskViewProps) {
  const presentation = usePresentation();
  const [secret, setSecret] = useState<string | undefined>(() => takeControlSecret());
  const [label, setLabel] = useState(() => deviceLabel() || suggestedDeviceLabel());
  const desk = useDesk({
    ...(platform ? { platform } : {}),
    ...(secret ? { secret } : {}),
    label,
    onSecret: (value) => {
      if (value) storeControlSecret(value);
      setSecret(value);
    },
  });
  const [stage, setStage] = useState<Stage>("start");

  useEffect(() => {
    const timer = setInterval(() => setLabel(deviceLabel() || suggestedDeviceLabel()), 1000);
    return () => clearInterval(timer);
  }, []);

  // The desk fills the window edge to edge; the browser's default margin would frame it.
  useEffect(() => {
    const previous = document.body.style.margin;
    document.body.style.margin = "0";
    return () => {
      document.body.style.margin = previous;
    };
  }, []);

  const accents = presentation.design.tokens.base.accents;
  const openStage = () => {
    const sessionId = desk.selected?.id ?? "local";
    const fragment = secret ? `#key=${encodeURIComponent(secret)}` : "";
    window.open(`/stage/${sessionId}${fragment}`, "_blank", "noopener");
  };
  const show = (next: Stage) => (id: string) => {
    if (id) desk.select(id);
    setStage(next);
  };
  const release = () => {
    forgetControlSecret();
    setSecret(undefined);
    setStage("start");
  };
  const presenting = stage === "present" && platform && secret && desk.selected;
  const reviewing = stage === "review" && platform && secret && desk.selected;

  return (
    <main
      data-desk
      data-view={presenting ? "present" : reviewing ? "review" : "start"}
      data-control={desk.inControl || undefined}
      style={{
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: light.text,
        background: light.page,
        minHeight: "100dvh",
        // The desk takes only the chapter accents from the design (spec §7).
        ...({
          [accentVariable]: chapterAccent(presentation.design, 0),
          ...Object.fromEntries(
            accents.map((accent, index) => [accentVariableAt(index + 1), accent]),
          ),
        } as Record<string, string>),
      }}
    >
      {presenting ? (
        <PresentTab
          platform={platform}
          secret={secret}
          session={desk.selected as Session}
          {...(desk.presence ? { presence: desk.presence } : {})}
          {...(desk.join ? { join: desk.join } : {})}
          openStage={openStage}
          onBack={() => setStage("start")}
          onExtend={(minutes) => desk.extend((desk.selected as Session).id, minutes)}
          onEnd={async (keepTimings) => {
            await desk.close((desk.selected as Session).id, keepTimings);
            setStage("review");
          }}
        />
      ) : (
        <div style={{ display: "grid", gap: 24, padding: "24px clamp(16px, 4vw, 48px)" }}>
          <Header
            desk={desk}
            onRelease={release}
            {...(reviewing ? { back: () => setStage("start") } : {})}
          />
          {reviewing ? (
            <ReviewTab
              platform={platform}
              secret={secret}
              session={desk.selected as Session}
              onChanged={desk.refresh}
            />
          ) : (
            <Start
              desk={desk}
              hosted={Boolean(platform)}
              openStage={openStage}
              onPresent={show("present")}
              onReview={show("review")}
            />
          )}
        </div>
      )}
    </main>
  );
}
