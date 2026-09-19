import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { typedClient } from "../client/client";
import type { Presentation } from "../deck/presentation";
import type { PlatformClient } from "../platform/contract";
import type { CoreApi } from "../server/runtime";
import { parseRoute, positionOf, stepIndexOf } from "../stage/navigation";
import { type CursorTransport, hostedTransport, localTransport } from "../sync/transport";
import { takeControlSecret } from "./access";
import { PresentationContext, usePresentation } from "./context";
import { useNavigation } from "./hooks";
import { PhoneView } from "./PhoneView";
import { Stage } from "./Stage";
import { SessionContext, type SessionInfo } from "./session-context";

/** Options of `mount`. */
export interface MountOptions {
  /** The element to render into; defaults to `#root`. */
  root?: Element;
  /** The hosted platform's client; without it, the talk runs in local mode (spec §4.1). */
  platform?: PlatformClient;
}

/** Props of `StageView`. */
export interface StageViewProps {
  sessionId: string;
  /** Whether this window may steer; local mode and a held control secret allow it. */
  canSteer: boolean;
  /** The step index a deep link asks for. */
  deepLink?: number;
  /** Creates the session's transport; called once per mount, closed on unmount. */
  createTransport(): CursorTransport;
  /** How the audience joins this session; a stage shows it as a QR code. */
  session: SessionInfo;
  /** Asks the server how the audience joins; only a window with the control secret can. */
  loadJoin?(): Promise<Pick<SessionInfo, "kind" | "joinPath">>;
}

/**
 * The stage view at `/stage/<sessionId>`: the stage plus navigation, kept in step with the other
 * windows of the session by its transport. It shows whether it runs locally or hosted, and
 * whether it is connected, as `data-sync` and `data-connected`.
 */
export function StageView({
  sessionId,
  canSteer,
  deepLink,
  createTransport,
  session,
  loadJoin,
}: StageViewProps) {
  const presentation = usePresentation();
  const [transport, setTransport] = useState<CursorTransport>();
  const [info, setInfo] = useState(session);
  // This window's own last move. A deep link steers before the transport exists, and StrictMode
  // throws the first transport away, so every new transport is told where this window stands.
  const lastMove = useRef<Parameters<CursorTransport["send"]>[0]>(undefined);
  const [connected, setConnected] = useState(false);
  const navigation = useNavigation(presentation, {
    canSteer,
    deepLink,
    onMove(index) {
      const { slide, step } = positionOf(presentation, index);
      const target = { index, slideId: slide.id, step };
      lastMove.current = target;
      transport?.send(target);
    },
  });
  const { receive } = navigation;

  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once per session
  useEffect(() => {
    setInfo(session);
    if (!loadJoin) return;
    let current = true;
    loadJoin().then(
      (join) => current && setInfo({ ...session, ...join }),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [sessionId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one transport per mount and session
  useEffect(() => {
    const created = createTransport();
    setTransport(created);
    if (canSteer && lastMove.current) created.send(lastMove.current);
    const stopCursor = created.onCursor((cursor) => {
      receive(stepIndexOf(presentation, cursor.slideId, cursor.step) ?? cursor.index);
    });
    const stopStatus = created.onStatus(setConnected);
    return () => {
      stopCursor();
      stopStatus();
      created.close();
    };
  }, [sessionId]);

  return (
    <div
      data-session={sessionId}
      data-steering={canSteer || undefined}
      data-sync={transport?.kind}
      data-connected={connected}
    >
      <SessionContext.Provider value={info}>
        <Stage index={navigation.index} />
      </SessionContext.Provider>
    </div>
  );
}

function Pending({ presentation, view }: { presentation: Presentation; view: string }) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>{presentation.meta.title}</h1>
      <p>{presentation.text("core.view.unavailable", { view })}</p>
    </main>
  );
}

/**
 * Renders the presentation's views by address (spec §9): `/` and `/r/<joinToken>` for the
 * phones, `/stage/<sessionId>` for the stage; desk and print follow in their own tickets.
 */
export function mount(presentation: Presentation, options: MountOptions = {}): void {
  const element = options.root ?? document.getElementById("root");
  if (!element) throw new Error('mount needs a root element, e.g. <div id="root">.');
  const route = parseRoute(window.location.pathname, window.location.search);
  const secret = takeControlSecret();
  let view = <Pending presentation={presentation} view={route.view} />;
  if (route.view === "phone") {
    view = (
      <PhoneView
        {...(route.joinToken ? { joinToken: route.joinToken } : {})}
        {...(options.platform ? { platform: options.platform } : {})}
      />
    );
  }
  if (route.view === "stage") {
    const deepLink = route.slide ? stepIndexOf(presentation, route.slide, route.step) : undefined;
    const { platform } = options;
    const sessionId = route.sessionId;
    const api = platform ? typedClient<CoreApi>(platform) : undefined;
    view = (
      <StageView
        sessionId={sessionId}
        canSteer={!platform || Boolean(secret)}
        deepLink={deepLink}
        session={{ sessionId, hosted: Boolean(platform) }}
        {...(api && secret ? { loadJoin: () => api.sessionJoin(secret, sessionId) } : {})}
        createTransport={() =>
          platform
            ? hostedTransport({ platform, sessionId, secret })
            : localTransport({ sessionId })
        }
      />
    );
  }
  createRoot(element).render(
    <StrictMode>
      <PresentationContext.Provider value={presentation}>{view}</PresentationContext.Provider>
    </StrictMode>,
  );
}
