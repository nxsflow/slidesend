import { createContext, useContext, useMemo } from "react";
import { type ResponseStore, responseStore } from "../client/client";
import type { ActivityNode } from "../nodes/types";
import type { PlatformClient } from "../platform/contract";
import { nodeData, usePresentation } from "./context";

/** What an activity's component may ask for while it runs. */
export interface ActivityScope {
  sessionId: string;
  activityId: string;
  deviceId: string;
  platform?: PlatformClient;
}

const ActivityContext = createContext<ActivityScope | undefined>(undefined);

/**
 * The response store of the running activity (spec §6.4): write a response, read one's own, and
 * follow all of them. Outside an activity, or without a platform, it is `undefined`.
 */
export function useResponseStore(): ResponseStore | undefined {
  const scope = useContext(ActivityContext);
  return useMemo(
    () =>
      scope?.platform
        ? responseStore({
            platform: scope.platform,
            sessionId: scope.sessionId,
            activityId: scope.activityId,
            deviceId: scope.deviceId,
          })
        : undefined,
    [scope],
  );
}

/** What the running activity is, for components that need its id or the device. */
export function useActivityScope(): ActivityScope | undefined {
  return useContext(ActivityContext);
}

/** Props of `ActivityHost`. */
export interface ActivityHostProps {
  node: ActivityNode;
  sessionId: string;
  deviceId: string;
  platform?: PlatformClient;
  /** Render the desk's live tile instead of the phone's component (spec §12). */
  monitor?: boolean;
}

/**
 * Renders one activity on a phone with its own response store. The component is keyed by the
 * activity's id where it is used, so a new activity never inherits the previous one's state.
 */
export function ActivityHost({
  node,
  sessionId,
  deviceId,
  platform,
  monitor = false,
}: ActivityHostProps) {
  const { registry } = usePresentation();
  const definition = registry.definition(node.type);
  const activityId = String((node as { id?: unknown }).id ?? node.type);
  const scope = useMemo(
    () => ({ sessionId, activityId, deviceId, platform }),
    [sessionId, activityId, deviceId, platform],
  );
  if (definition?.group !== "activity") return null;
  const Component = monitor ? definition.Monitor : definition.Participant;
  if (!Component) return null;
  return (
    <ActivityContext.Provider value={scope}>
      <Component data={nodeData(node, ["type"])} />
    </ActivityContext.Provider>
  );
}
