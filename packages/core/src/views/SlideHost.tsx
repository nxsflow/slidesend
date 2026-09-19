import { useEffect, useState } from "react";
import type { AnySlideTemplate } from "../nodes/define";
import type { SlideProps } from "../nodes/types";
import { positionOf } from "../stage/navigation";
import { nodeData, usePresentation } from "./context";

/** A leaving slide stays mounted this long unless its template or the design says otherwise. */
export const defaultLeaveMs = 600;

interface Shown extends Omit<SlideProps<unknown>, "data"> {
  slideIndex: number;
}

interface HostState {
  index: number;
  current: Shown;
  leaving: Shown | null;
}

function SlideLayer({ shown }: { shown: Shown }) {
  const { slides, registry } = usePresentation();
  const slide = slides[shown.slideIndex];
  const definition =
    slide && (registry.definition(slide.node.type) as AnySlideTemplate | undefined);
  if (!slide || !definition) return null;
  const { Component } = definition;
  return (
    <div
      data-slide-id={slide.id}
      data-step={shown.step}
      data-presence={shown.presence}
      aria-hidden={shown.presence === "leaving" || undefined}
      style={{ position: "absolute", inset: 0 }}
    >
      <Component
        data={nodeData(slide.node, ["type", "chapter", "id"])}
        step={shown.step}
        previousStep={shown.previousStep}
        direction={shown.direction}
        presence={shown.presence}
      />
    </div>
  );
}

/**
 * Mounts the slide at the given step (spec §6.1). Within a slide it passes the new step, the
 * previous step and the direction. When the slide changes, the old one stays mounted as
 * `leaving` for its template's `leaveMs` while the new one is `entering`; after that the new one
 * is `present`. How anything moves is the template's business.
 */
export function SlideHost({ index }: { index: number }) {
  const presentation = usePresentation();
  const [state, setState] = useState<HostState>(() => {
    const { slide, step } = positionOf(presentation, index);
    return {
      index,
      current: {
        slideIndex: slide.index,
        step,
        previousStep: null,
        direction: "forward",
        presence: "entering",
      },
      leaving: null,
    };
  });

  // Derived from the previous render, as React recommends for state that follows a prop.
  if (state.index !== index) {
    const { slide, step } = positionOf(presentation, index);
    const direction = index > state.index ? "forward" : "backward";
    if (slide.index === state.current.slideIndex) {
      setState({
        index,
        leaving: state.leaving,
        current: { ...state.current, step, previousStep: state.current.step, direction },
      });
    } else {
      setState({
        index,
        leaving: { ...state.current, direction, presence: "leaving" },
        current: {
          slideIndex: slide.index,
          step,
          previousStep: null,
          direction,
          presence: "entering",
        },
      });
    }
  }

  const leavingTemplate =
    state.leaving &&
    (presentation.registry.definition(
      presentation.slides[state.leaving.slideIndex]?.node.type ?? "",
    ) as AnySlideTemplate | undefined);
  const settleMs = leavingTemplate?.leaveMs ?? presentation.design.leaveMs ?? defaultLeaveMs;

  useEffect(() => {
    if (state.current.presence === "present" && !state.leaving) return;
    const timer = setTimeout(() => {
      setState((latest) => ({
        ...latest,
        leaving: null,
        current: { ...latest.current, presence: "present" },
      }));
    }, settleMs);
    return () => clearTimeout(timer);
  }, [state.current.presence, state.leaving, settleMs]);

  return (
    <>
      {state.leaving && (
        <SlideLayer key={`leaving-${state.leaving.slideIndex}`} shown={state.leaving} />
      )}
      <SlideLayer key={`current-${state.current.slideIndex}`} shown={state.current} />
    </>
  );
}
