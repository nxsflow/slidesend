import { createContext, useContext } from "react";
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
