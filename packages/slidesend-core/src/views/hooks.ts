import { useCallback, useEffect, useRef, useState } from "react";
import type { Presentation } from "../deck/presentation";
import {
  keyAction,
  type NavigationAction,
  type NavigationState,
  navigate,
  type StageFit,
  stageFit,
} from "../stage/navigation";

/** The stage's fit to the window, recalculated on every resize. */
export function useStageFit(): StageFit {
  const [fit, setFit] = useState<StageFit>(() => stageFit(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const update = () => setFit(stageFit(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return fit;
}

/** Options of `useNavigation`. */
export interface NavigationOptions {
  /** Whether this window may move the cursor; otherwise it follows. */
  canSteer: boolean;
  /** A deep link's step index, applied once. */
  deepLink?: number;
  /** Called with every move this window makes, to send it to the others. */
  onMove?(index: number): void;
}

/** A stage's navigation: the current step, the moves, and a way to take moves from elsewhere. */
export interface Navigation {
  index: number;
  next(): void;
  previous(): void;
  goto(index: number): void;
  /** Takes a move another window made. */
  receive(index: number): void;
}

/**
 * Navigation through the flat step list with keyboard and presenter-remote keys. The position is
 * kept in a ref and updated synchronously, so several key presses within one tick all count.
 * Moves are sent when they happen, not from an effect on state, which StrictMode would repeat.
 */
export function useNavigation(presentation: Presentation, options: NavigationOptions): Navigation {
  const { canSteer, deepLink } = options;
  const state = useRef<NavigationState>({ index: 0, pinned: false });
  const [index, setIndex] = useState(0);
  const onMove = useRef(options.onMove);
  onMove.current = options.onMove;

  const dispatch = useCallback(
    (action: NavigationAction) => {
      const result = navigate(presentation, state.current, action, canSteer);
      state.current = result.state;
      setIndex(result.state.index);
      if (result.send !== undefined) onMove.current?.(result.send);
    },
    [presentation, canSteer],
  );

  const applied = useRef(false);
  useEffect(() => {
    if (deepLink === undefined || applied.current) return;
    applied.current = true;
    dispatch({ type: "deepLink", index: deepLink });
  }, [deepLink, dispatch]);

  useEffect(() => {
    if (!canSteer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }
      const action = keyAction(event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "first") dispatch({ type: "goto", index: 0 });
      else if (action === "last") dispatch({ type: "goto", index: presentation.steps.length - 1 });
      else dispatch({ type: action });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSteer, dispatch, presentation]);

  return {
    index,
    next: useCallback(() => dispatch({ type: "next" }), [dispatch]),
    previous: useCallback(() => dispatch({ type: "previous" }), [dispatch]),
    goto: useCallback((target: number) => dispatch({ type: "goto", index: target }), [dispatch]),
    receive: useCallback(
      (target: number) => dispatch({ type: "remote", index: target }),
      [dispatch],
    ),
  };
}
