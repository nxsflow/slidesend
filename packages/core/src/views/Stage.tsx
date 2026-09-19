import { fontFaceCss, stageFrameProps, surfaceVariables } from "../design/css";
import { cssVariable } from "../design/tokens";
import { type StageFit, stageHeight, stageWidth } from "../stage/navigation";
import { usePresentation } from "./context";
import { useStageFit } from "./hooks";
import { SlideHost } from "./SlideHost";

/** The 1920 × 1080 surface itself, at the given fit: the stage and its previews share it. */
export function StageSurface({
  index,
  fit,
  interactive = true,
}: {
  index: number;
  fit: StageFit;
  /** A preview is not touched; it also must not take the pointer from the desk. */
  interactive?: boolean;
}) {
  const presentation = usePresentation();
  const { design } = presentation;
  const { scale, left, top } = fit;
  const frame = stageFrameProps(presentation, index);
  const { StageFrame } = design;
  return (
    <div
      data-stage
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: stageWidth,
        height: stageHeight,
        overflow: "hidden",
        transformOrigin: "top left",
        transform: `translate(${left}px, ${top}px) scale(${scale})`,
        color: `var(${cssVariable("color", "text")})`,
        fontFamily: `var(${cssVariable("font", "sans")})`,
        pointerEvents: interactive ? undefined : "none",
      }}
    >
      <StageFrame {...frame}>
        <SlideHost index={index} />
      </StageFrame>
    </div>
  );
}

/** The design's stage tokens for a surface that shows slides, e.g. the stage or a preview. */
export function stageSurfaceStyle(
  presentation: ReturnType<typeof usePresentation>,
  index: number,
): Record<string, string> {
  const chapterIndex = stageFrameProps(presentation, index).progress.chapterIndex;
  return {
    background: `var(${cssVariable("color", "background")})`,
    ...surfaceVariables(presentation.design, "stage", chapterIndex),
  };
}

/**
 * The stage (spec §6.1): the fixed 1920 × 1080 area, scaled and centered by calculation, with the
 * design's stage tokens, fonts and `StageFrame` around the slide host.
 */
export function Stage({ index }: { index: number }) {
  const presentation = usePresentation();
  const { design } = presentation;
  const fit = useStageFit();
  return (
    <div
      data-surface="stage"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        ...stageSurfaceStyle(presentation, index),
      }}
    >
      <style>{fontFaceCss(design.fonts)}</style>
      <StageSurface index={index} fit={fit} />
    </div>
  );
}
