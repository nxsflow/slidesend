import { useEffect, useMemo, useState } from "react";
import { typedClient } from "../client/client";
import { fontFaceCss, surfaceVariables } from "../design/css";
import { cssVariable } from "../design/tokens";
import type { PlatformClient } from "../platform/contract";
import type { CoreApi } from "../server/runtime";
import type { PhoneSession } from "../sessions/types";
import { stepIndexOf } from "../stage/navigation";
import { browserEnvironment, hostedTransport } from "../sync/transport";
import { ActivityHost } from "./ActivityHost";
import { visibleActivities } from "./activities";
import { usePresentation } from "./context";
import { deviceId } from "./device";

/** How often a phone asks again which session it belongs to. */
export const sessionPollMs = 15_000;

/** Props of `PhoneView`. */
export interface PhoneViewProps {
  /** A rehearsal's token from `/r/<joinToken>`; live sessions have none. */
  joinToken?: string;
  /** The hosted platform; without one there is no audience, and the phone stays idle. */
  platform?: PlatformClient;
}

/**
 * The participant view at `/` and `/r/<joinToken>` (spec §9): it finds its session, follows the
 * cursor, and shows the activity of the current step plus the ones that asked to stay. It never
 * steers, and it never sends anything outside an open session.
 */
export function PhoneView({ joinToken, platform }: PhoneViewProps) {
  const presentation = usePresentation();
  const { design, meta, text } = presentation;
  const device = useMemo(() => deviceId(), []);
  const api = useMemo(() => (platform ? typedClient<CoreApi>(platform) : undefined), [platform]);
  const [session, setSession] = useState<PhoneSession>({ page: "idle" });
  const [stepIndex, setStepIndex] = useState(0);

  // Which session this phone belongs to: asked again when the page wakes up and on a slow pulse,
  // so a phone that was locked while the talk started joins by itself.
  useEffect(() => {
    if (!api) return;
    let stopped = false;
    const environment = browserEnvironment();
    const load = () => {
      api.phoneSession(joinToken).then(
        (found) => !stopped && setSession(found),
        () => {},
      );
    };
    load();
    const stopWake = environment.onWake(load);
    const pulse = environment.setInterval(() => {
      if (environment.isVisible()) load();
    }, sessionPollMs);
    return () => {
      stopped = true;
      stopWake();
      environment.clearInterval(pulse);
    };
  }, [api, joinToken]);

  const sessionId = session.page === "open" ? session.sessionId : undefined;
  useEffect(() => {
    if (!platform || !sessionId) return;
    const transport = hostedTransport({ platform, sessionId });
    const stop = transport.onCursor((cursor) => {
      setStepIndex(stepIndexOf(presentation, cursor.slideId, cursor.step) ?? cursor.index);
    });
    return () => {
      stop();
      transport.close();
    };
  }, [platform, sessionId, presentation]);

  const step = presentation.steps[stepIndex];
  const chapterIndex = presentation.chapters.findIndex((chapter) => chapter.id === step?.chapter);
  const activities = sessionId ? visibleActivities(presentation, stepIndex) : [];
  const { PhoneFrame, StartPage, ClosedPage, IdlePage } = design;

  let content = <IdlePage />;
  if (session.page === "closed") content = <ClosedPage title={meta.title} />;
  else if (sessionId && activities.length === 0) {
    content = (
      <StartPage title={meta.title} {...(meta.subtitle ? { subtitle: meta.subtitle } : {})} />
    );
  } else if (sessionId) {
    content = (
      <div style={{ display: "grid", gap: 24 }}>
        {activities.map(({ activity, current }) => {
          const id = String((activity as { id?: unknown }).id ?? activity.type);
          const message = (activity as { message?: string }).message;
          return (
            <section key={id} data-activity={id} data-kept={!current || undefined}>
              {message && (
                <p
                  data-activity-message
                  style={{ margin: "0 0 12px", color: `var(${cssVariable("color", "textMuted")})` }}
                >
                  {message}
                </p>
              )}
              <ActivityHost
                key={id}
                node={activity}
                sessionId={sessionId}
                deviceId={device}
                {...(platform ? { platform } : {})}
              />
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div
      data-surface="phone"
      style={{
        minHeight: "100dvh",
        background: `var(${cssVariable("color", "background")})`,
        color: `var(${cssVariable("color", "text")})`,
        fontFamily: `var(${cssVariable("font", "sans")})`,
        ...surfaceVariables(design, "phone", Math.max(0, chapterIndex)),
      }}
    >
      <style>{fontFaceCss(design.fonts)}</style>
      <div
        data-phone
        data-page={session.page}
        data-session={sessionId}
        data-step={stepIndex}
        data-device={device}
        data-hosted={Boolean(platform) || undefined}
        title={platform ? undefined : text("core.join.local")}
      >
        <PhoneFrame
          {...(sessionId && chapterIndex >= 0
            ? {
                chapter: {
                  title: presentation.chapters[chapterIndex]?.title ?? "",
                  index: chapterIndex,
                },
              }
            : {})}
        >
          {content}
        </PhoneFrame>
      </div>
    </div>
  );
}
