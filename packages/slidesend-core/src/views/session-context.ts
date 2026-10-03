import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { responseStore } from "../client/client";
import type { PlatformClient } from "../platform/contract";
import type { ActivityResponse } from "../sessions/runtime-types";
import type { SessionKind } from "../sessions/types";

/** What the views know about the session they show (spec §9, §12). */
export interface SessionInfo {
  /** The session's id, or `"local"` in local mode. */
  sessionId: string;
  kind?: SessionKind;
  /** Where the audience joins: `/` in a live session, `/r/<token>` in a rehearsal. */
  joinPath?: string;
  /** Whether a hosted platform is behind this view; without one, no audience can join. */
  hosted: boolean;
  /** The platform, so that stage blocks and desk tiles can follow responses. */
  platform?: PlatformClient;
}

/** The session of the surrounding view; `mount` provides it. */
export const SessionContext = createContext<SessionInfo | undefined>(undefined);

/**
 * The session of the surrounding view, for blocks and activities that need it, such as a QR code
 * of the join address. Outside a view it is `undefined`.
 */
export function useSessionInfo(): SessionInfo | undefined {
  return useContext(SessionContext);
}

/** The full join address of a session, or `undefined` in local mode. */
export function joinUrl(info: SessionInfo | undefined, origin: string): string | undefined {
  return info?.hosted && info.joinPath ? `${origin.replace(/\/$/, "")}${info.joinPath}` : undefined;
}

const watcherId = "watch";

/**
 * Follows every response of an activity, for a stage block or a desk tile (spec §6.5). It loads
 * the responses once and then keeps them up to date, and it returns an empty list wherever there
 * is no session, e.g. in local mode or in print.
 */
export function useResponses(activityId: string | undefined): ActivityResponse[] {
  const session = useSessionInfo();
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const store = useMemo(
    () =>
      session?.platform && activityId
        ? responseStore({
            platform: session.platform,
            sessionId: session.sessionId,
            activityId,
            deviceId: watcherId,
          })
        : undefined,
    [session?.platform, session?.sessionId, activityId],
  );

  useEffect(() => {
    setResponses([]);
    return store?.follow(setResponses);
  }, [store]);

  return responses;
}
