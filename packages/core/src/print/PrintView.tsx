/**
 * The talk on paper, at `/print` (spec §4, §6.3).
 *
 * It prints the real slides — the same templates, the same design, the same 1920 × 1080 surface —
 * rather than a second rendering that could drift from the stage. Two decisions carry this file:
 *
 * - **The scale is computed, never measured.** A page is A4 landscape, the surface is 1920 wide,
 *   and one division settles it. A measuring loop would have every block dimension itself twice
 *   and would race the print dialog.
 * - **The slides stand still.** Templates animate on the stage; a page must never catch one
 *   halfway into view, so print renders the step as `present` with no direction to move along.
 *
 * The print-specific colours here are the paper's own, not the design's: slidesend-allow-literal-styles.
 */
import { fontFaceCss } from "../design/css";
import { stageHeight, stageWidth } from "../stage/navigation";
import { Block } from "../views/Block";
import { usePresentation, useText } from "../views/context";
import { StageSurface, stageSurfaceStyle } from "../views/Stage";
import { type PrintStep, printSteps } from "./rules";

/** A4 landscape at 96 dpi: 297 mm wide. The page's own unit stays mm; this is only the scale. */
const sheetPx = 1122;
/** White space around the slide on the page, in px at the same 96 dpi. */
const margin = 52;
/** How much of 1920 fits between the margins. */
export const printScale = (sheetPx - 2 * margin) / stageWidth;

/**
 * The print stylesheet.
 *
 * `@page` is landscape with no margin of its own — the page element carries the white space, so
 * a slide can bleed to the edge if its design says so. Both the modern and the legacy break
 * properties are set: with only `break-after`, Chromium merged several slides onto one sheet.
 * The height is a millimetre under A4's 210 to keep a rounded-up pixel from starting a blank
 * page. And the app's own full-height, no-scroll layout is undone while this view is on screen,
 * or everything below the first screenful is simply clipped away.
 */
const printCss = `
@page { size: A4 landscape; margin: 0; }
html:has([data-print]), body:has([data-print]) {
  height: auto;
  overflow: visible;
  background: #ffffff;
  /* The browser's own body margin pushes the last sheet past the end and adds a blank page. */
  margin: 0;
  padding: 0;
}
[data-print-page], [data-print-page] * { box-sizing: border-box; }
[data-print-page] {
  width: 297mm;
  /* With the default content-box the padding would be ADDED to this height, and every sheet
     would be taller than the paper it prints on — which Chromium answers with extra pages. */
  height: 209mm;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  break-after: page;
  page-break-after: always;
  break-inside: avoid;
  page-break-inside: avoid;
}
[data-print-page]:last-child { break-after: auto; page-break-after: auto; }
@media screen {
  [data-print] { background: #e9e9e6; padding: 16px; display: grid; gap: 16px; justify-items: center; }
  [data-print-page] { background: #ffffff; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2); }
}
`;

/** One printed page: the slide as it stood, and underneath what the speaker had to say to it. */
function Page({ page }: { page: PrintStep }) {
  const presentation = usePresentation();
  const { slide, step, index, text, replaceWith } = page;
  const height = Math.round(stageHeight * printScale);
  return (
    <article
      data-print-page
      data-slide-id={slide.id}
      data-step={step.step}
      style={{ padding: `${margin}px`, color: "#1c1d21", fontFamily: "Georgia, serif" }}
    >
      <div
        style={{
          position: "relative",
          width: sheetPx - 2 * margin,
          height,
          overflow: "hidden",
          ...stageSurfaceStyle(presentation, index),
        }}
      >
        {replaceWith ? (
          <StageSurface
            index={index}
            fit={{ scale: printScale, left: 0, top: 0 }}
            interactive={false}
            still
          >
            <Block node={replaceWith} print />
          </StageSurface>
        ) : (
          <StageSurface
            index={index}
            fit={{ scale: printScale, left: 0, top: 0 }}
            interactive={false}
            still
          />
        )}
      </div>
      <footer style={{ paddingTop: 14, display: "grid", gap: 6 }}>
        {text && (
          <p
            data-print-text
            style={{ margin: 0, fontSize: 13, lineHeight: 1.45, maxWidth: "96ch" }}
          >
            {text}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 10, color: "#5d616b" }}>
          {slide.label} · {slide.id}:{step.step}
        </p>
      </footer>
    </article>
  );
}

/** The cover: what this is, so a printed stack says which talk it came from. */
function Cover() {
  const presentation = usePresentation();
  const text = useText();
  const { meta, chapters, slides, steps } = presentation;
  return (
    <article
      data-print-page
      data-cover
      style={{
        padding: "36mm 30mm",
        color: "#1c1d21",
        fontFamily: "Georgia, serif",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.15 }}>{meta.title}</h1>
      {meta.subtitle && <p style={{ margin: 0, fontSize: 18 }}>{meta.subtitle}</p>}
      <p style={{ margin: 0, fontSize: 12, color: "#5d616b" }}>
        {text("core.print.counts", {
          slides: slides.length,
          steps: steps.length,
          minutes: Math.round(presentation.plannedMinutes),
        })}
      </p>
      <ol style={{ margin: 0, paddingLeft: "1.2em", fontSize: 13, lineHeight: 1.7 }}>
        {chapters.map((chapter) => (
          <li key={chapter.id}>{chapter.title}</li>
        ))}
      </ol>
    </article>
  );
}

/**
 * The print view. It renders every page at once — no lazy loading, no virtual list: the printer
 * asks for the whole document in one go, and anything not in the DOM is not on paper.
 */
export function PrintView() {
  const presentation = usePresentation();
  const pages = printSteps(presentation);
  return (
    <main data-print data-pages={pages.length}>
      <style>{`${fontFaceCss(presentation.design.fonts)}${printCss}`}</style>
      <Cover />
      {pages.map((page) => (
        <Page key={`${page.slide.id}:${page.step.step}`} page={page} />
      ))}
    </main>
  );
}
