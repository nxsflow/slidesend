import { type ReactNode, useLayoutEffect, useRef } from "react";

/** Props of `FitBox`. */
export interface FitBoxProps {
  children: ReactNode;
  /** Measure again when this changes, e.g. the slide id and step. */
  measureKey?: string | number;
  /** Center the content horizontally instead of stretching it to the full width. */
  centered?: boolean;
}

/**
 * Keeps content inside its box: it measures the content at its natural size and scales it down
 * when it is taller or wider than the space it gets, so no text runs over the slide's edge. A
 * ResizeObserver follows the space as it changes during an animation; the natural size is
 * measured once, and again when web fonts arrive. The scale is exposed as `data-fit`.
 */
export function FitBox({ children, measureKey, centered = false }: FitBoxProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: measureKey and centered trigger a new measurement
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    let naturalHeight = 0;
    let naturalWidth = 0;

    const measure = () => {
      content.style.transform = "none";
      naturalHeight = content.offsetHeight;
      naturalWidth = content.offsetWidth;
    };
    const applyScale = (height: number, width: number) => {
      if (!naturalHeight || !naturalWidth || !height || !width) return;
      const scale = Math.min(1, height / naturalHeight, width / naturalWidth);
      // Scale from the top center: a shrunk block stuck to the left edge looks misplaced.
      content.style.transformOrigin = "top center";
      content.style.transform = scale < 0.999 ? `scale(${scale})` : "none";
      box.dataset.fit = scale.toFixed(2);
    };

    measure();
    applyScale(box.clientHeight, box.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) applyScale(entry.contentRect.height, entry.contentRect.width);
    });
    observer.observe(box);
    let discarded = false;
    document.fonts?.ready
      .then(() => {
        if (discarded) return;
        measure();
        applyScale(box.clientHeight, box.clientWidth);
      })
      .catch(() => {});
    return () => {
      discarded = true;
      observer.disconnect();
    };
  }, [measureKey, centered]);

  return (
    <div
      ref={outer}
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
      }}
    >
      <div ref={inner} style={centered ? { maxWidth: "100%" } : { width: "100%" }}>
        {children}
      </div>
    </div>
  );
}
