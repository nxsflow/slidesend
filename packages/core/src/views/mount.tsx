import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Presentation } from "../deck/presentation";
import type { PlatformClient } from "../platform/contract";
import { parseRoute, stepIndexOf } from "../stage/navigation";
import { takeControlSecret } from "./access";
import { PresentationContext, usePresentation } from "./context";
import { useNavigation } from "./hooks";
import { Stage } from "./Stage";

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
}

/** The stage view at `/stage/<sessionId>`: the stage plus navigation. */
export function StageView({ sessionId, canSteer, deepLink }: StageViewProps) {
  const presentation = usePresentation();
  const navigation = useNavigation(presentation, { canSteer, deepLink });
  return (
    <div data-session={sessionId} data-steering={canSteer || undefined}>
      <Stage index={navigation.index} />
    </div>
  );
}

function Pending({ presentation, view }: { presentation: Presentation; view: string }) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>{presentation.meta.title}</h1>
      <p>The {view} view is not available yet.</p>
    </main>
  );
}

/**
 * Renders the presentation's views by address (spec §9): `/stage/<sessionId>` for the stage;
 * the phone, desk and print views follow in their own tickets.
 */
export function mount(presentation: Presentation, options: MountOptions = {}): void {
  const element = options.root ?? document.getElementById("root");
  if (!element) throw new Error('mount needs a root element, e.g. <div id="root">.');
  const route = parseRoute(window.location.pathname, window.location.search);
  const secret = takeControlSecret();
  let view = <Pending presentation={presentation} view={route.view} />;
  if (route.view === "stage") {
    const deepLink = route.slide ? stepIndexOf(presentation, route.slide, route.step) : undefined;
    view = (
      <StageView
        sessionId={route.sessionId}
        canSteer={!options.platform || Boolean(secret)}
        deepLink={deepLink}
      />
    );
  }
  createRoot(element).render(
    <StrictMode>
      <PresentationContext.Provider value={presentation}>{view}</PresentationContext.Provider>
    </StrictMode>,
  );
}
