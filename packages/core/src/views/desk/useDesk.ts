import { useCallback, useEffect, useMemo, useState } from "react";
import { typedClient } from "../../client/client";
import type { PlatformClient } from "../../platform/contract";
import type { CoreApi } from "../../server/runtime";
import type { Presence } from "../../sessions/runtime-types";
import { heartbeatMs } from "../../sessions/runtime-types";
import type { Session } from "../../sessions/types";
import { deviceId } from "../device";

/** How often the desk asks for the sessions and who is connected. */
export const deskPollMs = 5000;

/** What a desk knows and can do (spec §12, Prepare). */
export interface Desk {
  /** Whether this device holds control. */
  inControl: boolean;
  /** Every session, newest first. */
  sessions: Session[];
  /** The session the desk works on. */
  selected?: Session;
  select(sessionId: string): void;
  presence?: Presence;
  /** How the audience joins the selected session. */
  join?: { kind: Session["kind"]; joinPath: string };
  /** The last thing that went wrong, for the person at the desk. */
  problem?: string;
  /** Checks a secret and keeps it if it works. */
  takeControl(secret: string): Promise<boolean>;
  /** Creates a session and selects it. */
  create(input: { name: string; kind: Session["kind"]; plannedStart?: string }): Promise<void>;
  arm(sessionId: string): Promise<void>;
  disarm(sessionId: string): Promise<void>;
  open(sessionId: string): Promise<void>;
  extend(sessionId: string, minutes: number): Promise<void>;
  close(sessionId: string): Promise<void>;
  refresh(): void;
}

/** Options of `useDesk`. */
export interface DeskOptions {
  platform?: PlatformClient;
  /** The control secret this browser holds, if any. */
  secret?: string;
  /** Called when the desk takes a new secret, so the page can keep it. */
  onSecret(secret: string | undefined): void;
  /** This desk's label, sent with its heartbeat. */
  label: string;
}

/**
 * The desk's data: sessions, presence and the operations, all guarded by the control secret. It
 * polls rather than subscribing, which costs nothing while nobody watches (spec §11, Presence).
 */
export function useDesk({ platform, secret, onSecret, label }: DeskOptions): Desk {
  const api = useMemo(() => (platform ? typedClient<CoreApi>(platform) : undefined), [platform]);
  const device = useMemo(() => deviceId(), []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [presence, setPresence] = useState<Presence>();
  const [join, setJoin] = useState<Desk["join"]>();
  const [problem, setProblem] = useState<string>();
  const [inControl, setInControl] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const run = useCallback(
    async (what: () => Promise<unknown>) => {
      try {
        await what();
        setProblem(undefined);
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
      refresh();
    },
    [refresh],
  );

  // Sessions, while a secret is held. `tick` is deliberate: it reloads after an operation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!api || !secret) {
      setInControl(false);
      setSessions([]);
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const list = await api.sessionList(secret);
        if (stopped) return;
        setInControl(true);
        setSessions(list);
      } catch (error) {
        if (stopped) return;
        setInControl(false);
        setProblem(error instanceof Error ? error.message : String(error));
      }
    };
    void load();
    const timer = setInterval(load, deskPollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [api, secret, tick]);

  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0];
  const selectedSessionId = selected?.id;

  // The desk announces itself on the selected session and watches who else is there.
  useEffect(() => {
    if (!api || !secret || !selectedSessionId) {
      setPresence(undefined);
      setJoin(undefined);
      return;
    }
    let stopped = false;
    const beat = () => {
      api.presenceBeat(secret, selectedSessionId, "desk", device, label || "Desk").catch(() => {});
    };
    // Beat at the agreed cadence, but look at the others more often: a warning that names the
    // desk in control must not lag a heartbeat behind.
    const watch = () => {
      api.presenceList(secret, selectedSessionId).then(
        (found) => !stopped && setPresence(found),
        () => {},
      );
    };
    beat();
    watch();
    api.sessionJoin(secret, selectedSessionId).then(
      (found) => !stopped && setJoin(found),
      () => {},
    );
    const beating = setInterval(beat, heartbeatMs);
    const watching = setInterval(watch, deskPollMs);
    return () => {
      stopped = true;
      clearInterval(beating);
      clearInterval(watching);
    };
  }, [api, secret, selectedSessionId, device, label]);

  return {
    inControl,
    sessions,
    ...(selected ? { selected } : {}),
    select: setSelectedId,
    ...(presence ? { presence } : {}),
    ...(join ? { join } : {}),
    ...(problem ? { problem } : {}),
    async takeControl(candidate) {
      if (!api) return false;
      try {
        await api.controlCheck(candidate);
        onSecret(candidate);
        setProblem(undefined);
        refresh();
        return true;
      } catch {
        return false;
      }
    },
    create: (input) =>
      run(async () => {
        const created = await api?.sessionCreate(secret ?? "", input);
        // Work on what was just created, so it is also the one the list shows first.
        if (created) setSelectedId(created.id);
        return created;
      }),
    arm: (id) => run(() => api?.sessionArm(secret ?? "", id) ?? Promise.resolve()),
    disarm: (id) => run(() => api?.sessionDisarm(secret ?? "", id) ?? Promise.resolve()),
    open: (id) => run(() => api?.sessionOpen(secret ?? "", id) ?? Promise.resolve()),
    extend: (id, minutes) =>
      run(() => api?.sessionExtend(secret ?? "", id, minutes) ?? Promise.resolve()),
    close: (id) => run(() => api?.sessionClose(secret ?? "", id) ?? Promise.resolve()),
    refresh,
  };
}

/** The warnings the desk shows for the selected session (spec §9). */
export function deskWarnings(desk: Desk, device: string): { key: string; values: object }[] {
  const warnings: { key: string; values: object }[] = [];
  const live = desk.sessions.find(
    (session) =>
      session.kind === "live" && session.state === "open" && session.id !== desk.selected?.id,
  );
  if (live && desk.selected) {
    const controlling = desk.presence?.desks.find((entry) => entry.deviceId !== device);
    warnings.push({
      key: "core.desk.warning.liveOpen",
      values: { name: live.name, device: controlling?.label ?? "" },
    });
  }
  const other = desk.presence?.desks.find((entry) => entry.deviceId !== device);
  if (other) {
    warnings.push({
      key: "core.desk.warning.secondDesk",
      values: { device: other.label ?? other.deviceId },
    });
  }
  return warnings;
}

/** How many sessions the desk shows before it hides the older ones. */
export const shownSessions = 6;

const order: Record<Session["state"], number> = { open: 0, armed: 1, draft: 2, closed: 3 };

/** What runs or is about to run first, then the newest of the rest (spec §12, Session card). */
export function sortSessions(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => order[a.state] - order[b.state] || b.createdAt - a.createdAt);
}
