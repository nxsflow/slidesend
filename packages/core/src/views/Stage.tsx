import { fontFaceCss, stageFrameProps, surfaceVariables } from "../design/css";
import { cssVariable } from "../design/tokens";
import { stageHeight, stageWidth } from "../stage/navigation";
import { usePresentation } from "./context";
import { useStageFit } from "./hooks";
import { SlideHost } from "./SlideHost";

/**
 * The stage (spec §6.1): the fixed 1920 × 1080 area, scaled and centered by calculation, with the
 * design's stage tokens, fonts and `StageFrame` around the slide host.
 */
export function Stage({ index }: { index: number }) {
  const presentation = usePresentation();
  const { design } = presentation;
  const { scale, left, top } = useStageFit();
  const frame = stageFrameProps(presentation, index);
  const { StageFrame } = design;
  return (
    <div
      data-surface="stage"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: `var(${cssVariable("color", "background")})`,
        ...surfaceVariables(design, "stage", frame.progress.chapterIndex),
      }}
    >
      <style>{fontFaceCss(design.fonts)}</style>
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
        }}
      >
        <StageFrame {...frame}>
          <SlideHost index={index} />
        </StageFrame>
      </div>
    </div>
  );
}
