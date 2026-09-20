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
  takeControlSecret,
} from "../access";
import { usePresentation, useText } from "../context";
import { deviceId } from "../device";
import { PresentTab } from "./Present";
import { ReviewTab } from "./Review";
import { type Desk, deskWarnings, shownSessions, sortSessions, useDesk } from "./useDesk";

/** Props of `DeskView`. */
export interface DeskViewProps {
  /** The hosted platform; without one the desk runs in local mode, where there are no sessions. */
  platform?: PlatformClient;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      data-card={title}
      style={{
        border: "1px solid #d8d9d4",
        borderRadius: 12,
        padding: 20,
        display: "grid",
        gap: 12,
        minWidth: 0,
        background: "#ffffff",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
      {children}
    </section>
  );
}

const button = {
  fontSize: 15,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d8d9d4",
  background: "#f7f7f4",
  cursor: "pointer",
} as const;

const field = {
  fontSize: 15,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #d8d9d4",
} as const;

function ControlCard({ desk, onSecret }: { desk: Desk; onSecret(value?: string): void }) {
  const text = useText();
  const [draft, setDraft] = useState("");
  const [wrong, setWrong] = useState(false);
  const [label, setLabel] = useState(() => deviceLabel());

  return (
    <Card title={text("core.desk.control.title")}>
      <p data-control-state={desk.inControl ? "control" : "view-only"} style={{ margin: 0 }}>
        {desk.inControl ? text("core.desk.control.holds") : text("core.desk.control.viewOnly")}
      </p>
      {!desk.inControl && (
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={async (event) => {
            event.preventDefault();
            setWrong(!(await desk.takeControl(draft.trim())));
          }}
        >
          <input
            aria-label={text("core.desk.control.enter")}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            style={{ ...field, flex: 1, minWidth: 180 }}
          />
          <button type="submit" style={button}>
            {text("core.desk.control.save")}
          </button>
        </form>
      )}
      {wrong && (
        <p data-wrong style={{ margin: 0, color: "#c2372b" }}>
          {text("core.desk.control.wrong")}
        </p>
      )}
      {desk.inControl && (
        <button
          type="button"
          style={button}
          onClick={() => {
            forgetControlSecret();
            onSecret(undefined);
          }}
        >
          {text("core.desk.control.forget")}
        </button>
      )}
      <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
        {text("core.desk.label.title")}
        <input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setDeviceLabel(event.target.value);
          }}
          style={field}
        />
        <span style={{ color: "#5d616b" }}>{text("core.desk.label.hint")}</span>
      </label>
    </Card>
  );
}

function SessionCard({ desk }: { desk: Desk }) {
  const text = useText();
  const device = useMemo(() => deviceId(), []);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Session["kind"]>("live");
  const [plannedStart, setPlannedStart] = useState("");
  const [showAll, setShowAll] = useState(false);
  // The rehearsal whose closing is waiting for the answer "was this a timed run?".
  const [closing, setClosing] = useState<string>();
  const ordered = sortSessions(desk.sessions);
  const selected = desk.selected;
  const shown = showAll ? ordered : ordered.slice(0, shownSessions);
  // The session being worked on is always in the list, however old it is.
  if (selected && !shown.some((session) => session.id === selected.id)) shown.unshift(selected);
  const when = (value?: number) =>
    value === undefined
      ? ""
      : new Date(value).toLocaleTimeString(undefined, { timeStyle: "short" });

  return (
    <Card title={text("core.desk.sessions.title")}>
      {deskWarnings(desk, device).map((warning) => (
        <p
          key={warning.key}
          data-warning
          style={{ margin: 0, padding: 8, borderRadius: 8, background: "#fdf3d8" }}
        >
          {text(warning.key, {
            ...warning.values,
            device:
              (warning.values as { device?: string }).device ||
              text("core.desk.warning.unknownDevice"),
          })}
        </p>
      ))}
      {desk.sessions.length === 0 && <p style={{ margin: 0 }}>{text("core.desk.sessions.none")}</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {shown.map((session) => (
          <li
            key={session.id}
            data-session={session.id}
            data-state={session.state}
            data-selected={session.id === desk.selected?.id || undefined}
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              padding: 8,
              borderRadius: 8,
              border: `1px solid ${session.id === desk.selected?.id ? "#2f5bd3" : "#d8d9d4"}`,
            }}
          >
            <button
              type="button"
              style={{ ...button, flex: 1, textAlign: "left" }}
              onClick={() => desk.select(session.id)}
            >
              {session.name} · {text(`core.desk.sessions.state.${session.state}`)}
              {session.state === "armed" && session.opensAt
                ? ` · ${text("core.desk.sessions.opensAt", { time: when(session.opensAt) })}`
                : ""}
              {session.state === "open" && session.closesAt
                ? ` · ${text("core.desk.sessions.closesAt", { time: when(session.closesAt) })}`
                : ""}
            </button>
            {session.state === "draft" && session.plannedStart && (
              <button type="button" style={button} onClick={() => desk.arm(session.id)}>
                {text("core.desk.sessions.arm")}
              </button>
            )}
            {session.state === "armed" && (
              <button type="button" style={button} onClick={() => desk.disarm(session.id)}>
                {text("core.desk.sessions.disarm")}
              </button>
            )}
            {(session.state === "draft" || session.state === "armed") && (
              <button type="button" data-open style={button} onClick={() => desk.open(session.id)}>
                {text("core.desk.sessions.open")}
              </button>
            )}
            {session.state === "open" && (
              <>
                <button type="button" style={button} onClick={() => desk.extend(session.id, 10)}>
                  {text("core.desk.sessions.extend")}
                </button>
                {session.kind === "rehearsal" && closing === session.id ? (
                  <>
                    <span style={{ color: "#5d616b" }}>
                      {text("core.desk.review.timed", { session: session.name })}
                    </span>
                    <button
                      type="button"
                      data-close-timed
                      style={button}
                      onClick={() => {
                        setClosing(undefined);
                        void desk.close(session.id, true);
                      }}
                    >
                      {text("core.desk.review.timedYes")}
                    </button>
                    <button
                      type="button"
                      data-close-untimed
                      style={button}
                      onClick={() => {
                        setClosing(undefined);
                        void desk.close(session.id, false);
                      }}
                    >
                      {text("core.desk.review.timedNo")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-close
                    style={button}
                    onClick={() =>
                      session.kind === "rehearsal"
                        ? setClosing(session.id)
                        : void desk.close(session.id)
                    }
                  >
                    {text("core.desk.sessions.close")}
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {!showAll && ordered.length > shown.length && (
        <button type="button" data-show-all style={button} onClick={() => setShowAll(true)}>
          {text("core.desk.sessions.older", { count: ordered.length - shown.length })} ·{" "}
          {text("core.desk.sessions.showAll")}
        </button>
      )}
      <form
        data-create
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void desk.create({
            name: name.trim(),
            kind,
            ...(plannedStart ? { plannedStart: new Date(plannedStart).toISOString() } : {}),
          });
          setName("");
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1, minWidth: 160 }}>
          {text("core.desk.sessions.name")}
          <input
            aria-label={text("core.desk.sessions.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={field}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          {text("core.desk.sessions.kind")}
          <select
            aria-label={text("core.desk.sessions.kind")}
            value={kind}
            onChange={(event) => setKind(event.target.value as Session["kind"])}
            style={field}
          >
            <option value="live">{text("core.desk.sessions.live")}</option>
            <option value="rehearsal">{text("core.desk.sessions.rehearsal")}</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          {text("core.desk.sessions.plannedStart")}
          <input
            aria-label={text("core.desk.sessions.plannedStart")}
            type="datetime-local"
            value={plannedStart}
            onChange={(event) => setPlannedStart(event.target.value)}
            style={field}
          />
        </label>
        <button type="submit" style={button}>
          {text("core.desk.sessions.create")}
        </button>
      </form>
      {desk.presence && (
        <p data-presence style={{ margin: 0, color: "#5d616b" }}>
          {text("core.desk.presence.stages", { count: desk.presence.stages.length })} ·{" "}
          {text("core.desk.presence.desks", { count: desk.presence.desks.length })} ·{" "}
          {text("core.desk.presence.phones", { count: desk.presence.phones })}
        </p>
      )}
      {desk.problem && (
        <p data-problem style={{ margin: 0, color: "#c2372b" }}>
          {desk.problem}
        </p>
      )}
    </Card>
  );
}

function JoinCard({ desk, secret, hosted }: { desk: Desk; secret?: string; hosted: boolean }) {
  const text = useText();
  const [qr, setQr] = useState<string>();
  const url = desk.join ? `${window.location.origin}${desk.join.joinPath}` : undefined;

  useEffect(() => {
    if (!url) return setQr(undefined);
    let current = true;
    import("qrcode").then(
      ({ default: qrcode }) =>
        qrcode
          .toDataURL(url, { margin: 1, width: 220 })
          .then((image) => current && setQr(image))
          .catch(() => {}),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <Card title={text("core.desk.join.title")}>
      {!hosted && <p style={{ margin: 0 }}>{text("core.desk.join.local")}</p>}
      {url && (
        <>
          <p style={{ margin: 0 }}>{text("core.desk.join.phone")}</p>
          <a data-join href={url} style={{ wordBreak: "break-all" }}>
            {url}
          </a>
          {qr && <img src={qr} alt={url} width={220} height={220} />}
        </>
      )}
      <button
        type="button"
        data-open-stage
        style={button}
        onClick={() => {
          const sessionId = desk.selected?.id ?? "local";
          const fragment = secret ? `#key=${encodeURIComponent(secret)}` : "";
          window.open(`/stage/${sessionId}${fragment}`, "_blank", "noopener");
        }}
      >
        {text("core.desk.join.openStage")}
      </button>
    </Card>
  );
}

function DeckCard({ sessionMinutes }: { sessionMinutes?: number }) {
  const text = useText();
  const presentation = usePresentation();
  const planned = Math.round(presentation.plannedMinutes * 10) / 10;
  const over = sessionMinutes ? Math.round((planned - sessionMinutes) * 10) / 10 : 0;
  return (
    <Card title={text("core.desk.deck.title")}>
      <p style={{ margin: 0 }}>
        {text("core.desk.deck.counts", {
          slides: presentation.slides.length,
          steps: presentation.steps.length,
        })}
      </p>
      <p style={{ margin: 0 }}>{text("core.desk.deck.planned", { planned })}</p>
      {sessionMinutes !== undefined && (
        <p style={{ margin: 0 }}>{text("core.desk.deck.session", { minutes: sessionMinutes })}</p>
      )}
      {over > 0 && (
        <p data-over style={{ margin: 0, color: "#c2372b" }}>
          {text("core.desk.deck.over", { over })}
        </p>
      )}
    </Card>
  );
}

/**
 * The desk at `/desk` (spec §12). Prepare reads top to bottom like a checklist: who holds
 * control, the sessions, how the audience joins, and what the deck plans. Present and Review
 * follow in their own tickets.
 */
export function DeskView({ platform }: DeskViewProps) {
  const text = useText();
  const presentation = usePresentation();
  const [secret, setSecret] = useState<string | undefined>(() => takeControlSecret());
  const [label, setLabel] = useState(() => deviceLabel());
  const desk = useDesk({
    ...(platform ? { platform } : {}),
    ...(secret ? { secret } : {}),
    label,
    onSecret: (value) => {
      if (value) storeControlSecret(value);
      setSecret(value);
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setLabel(deviceLabel()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accents = presentation.design.tokens.base.accents;
  const [tab, setTab] = useState<"prepare" | "present" | "review">("prepare");
  const openStage = () => {
    const sessionId = desk.selected?.id ?? "local";
    const fragment = secret ? `#key=${encodeURIComponent(secret)}` : "";
    window.open(`/stage/${sessionId}${fragment}`, "_blank", "noopener");
  };
  const canPresent = Boolean(platform && secret && desk.selected);
  return (
    <main
      data-desk
      data-control={desk.inControl || undefined}
      style={{
        fontFamily: "system-ui, sans-serif",
        color: "#1c1d21",
        background: "#f7f7f4",
        minHeight: "100dvh",
        padding: 16,
        display: "grid",
        gap: 16,
        alignContent: "start",
        // The desk takes only the chapter accents from the design (spec §7).
        ...({
          [accentVariable]: chapterAccent(presentation.design, 0),
          ...Object.fromEntries(
            accents.map((accent, index) => [accentVariableAt(index + 1), accent]),
          ),
        } as Record<string, string>),
      }}
    >
      <header style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          {text("core.desk.title")} · {presentation.meta.title}
        </h1>
        <nav style={{ display: "flex", gap: 8 }}>
          {(["prepare", "present", "review"] as const).map((name) => (
            <button
              key={name}
              type="button"
              data-tab={name}
              data-active={tab === name || undefined}
              onClick={() => setTab(name)}
              disabled={name !== "prepare" && !canPresent}
              style={{
                ...button,
                fontWeight: tab === name ? 600 : 400,
                background: tab === name ? "#ffffff" : "#f7f7f4",
              }}
            >
              {text(`core.desk.tab.${name}`)}
            </button>
          ))}
        </nav>
      </header>
      {tab === "prepare" ? (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "start",
          }}
        >
          <ControlCard desk={desk} onSecret={(value) => setSecret(value)} />
          {platform && <SessionCard desk={desk} />}
          <JoinCard desk={desk} {...(secret ? { secret } : {})} hosted={Boolean(platform)} />
          <DeckCard {...(desk.selected ? { sessionMinutes: desk.selected.plannedMinutes } : {})} />
        </div>
      ) : tab === "review" ? (
        platform &&
        secret &&
        desk.selected && (
          <ReviewTab
            platform={platform}
            secret={secret}
            session={desk.selected}
            onChanged={desk.refresh}
          />
        )
      ) : (
        platform &&
        secret &&
        desk.selected && (
          <PresentTab
            platform={platform}
            secret={secret}
            session={desk.selected}
            {...(desk.presence ? { presence: desk.presence } : {})}
            openStage={openStage}
          />
        )
      )}
    </main>
  );
}
