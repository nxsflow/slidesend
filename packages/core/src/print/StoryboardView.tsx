/**
 * The storyboard at `/storyboard` (spec §4): the whole talk on one page, for reading it through
 * rather than presenting it.
 *
 * It is the counterpart of print. Print is the talk as the room saw it; the storyboard is the
 * talk as its author has to think about it — every slide small, next to what is said to it, how
 * long it is planned to take and what the speaker is supposed to do there. One slide per row, so
 * the eye can run down the notes column and read the talk as a text.
 *
 * Like print, it renders the real slides rather than a second drawing of them — the one place
 * where a storyboard usually drifts away from the deck it describes.
 *
 * Its colours are the page's own, not the design's: slidesend-allow-literal-styles.
 */
import { fontFaceCss } from "../design/css";
import { stageHeight, stageWidth } from "../stage/navigation";
import { usePresentation, useText } from "../views/context";
import { StageSurface, stageSurfaceStyle } from "../views/Stage";
import { type StoryboardEntry, storyboard } from "./rules";

/** How wide a slide is shown in the storyboard, in px; the scale follows from the stage's width. */
const thumbWidth = 320;
const thumbScale = thumbWidth / stageWidth;

const css = `
@page { size: A4 portrait; margin: 14mm; }
[data-storyboard-row] { break-inside: avoid; page-break-inside: avoid; }
`;

function Row({ entry }: { entry: StoryboardEntry }) {
  const presentation = usePresentation();
  const text = useText();
  const { slide, step, stepCount, minutes, notes, cues } = entry;
  return (
    <section
      data-storyboard-row
      data-slide-id={slide.id}
      style={{
        display: "grid",
        gridTemplateColumns: `${thumbWidth}px 1fr`,
        gap: 20,
        padding: "16px 0",
        borderTop: "1px solid #d8d9d4",
        alignItems: "start",
      }}
    >
      <div
        style={{
          position: "relative",
          width: thumbWidth,
          height: Math.round(stageHeight * thumbScale),
          overflow: "hidden",
          ...(step ? stageSurfaceStyle(presentation, step.index) : {}),
        }}
      >
        {step && (
          <StageSurface
            index={step.index}
            fit={{ scale: thumbScale, left: 0, top: 0 }}
            interactive={false}
            still
          />
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          {slide.index + 1}. {slide.label}
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#5d616b" }}>
          {text("core.storyboard.steps", { steps: stepCount, minutes })}
        </p>
        {cues.map((cue) => (
          <p key={cue} data-cue style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            {cue}
          </p>
        ))}
        {notes.map((note) => (
          <p key={note} data-note style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}

/** The storyboard view. */
export function StoryboardView() {
  const presentation = usePresentation();
  const text = useText();
  const entries = storyboard(presentation);
  const { meta, slides, steps } = presentation;
  return (
    <main
      data-storyboard
      data-rows={entries.length}
      style={{
        fontFamily: "system-ui, sans-serif",
        color: "#1c1d21",
        background: "#ffffff",
        maxWidth: 900,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <style>{`${fontFaceCss(presentation.design.fonts)}${css}`}</style>
      <header style={{ display: "grid", gap: 6, paddingBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{meta.title}</h1>
        <p style={{ margin: 0, fontSize: 12, color: "#5d616b" }}>
          {text("core.print.counts", {
            slides: slides.length,
            steps: steps.length,
            minutes: Math.round(presentation.plannedMinutes),
          })}
        </p>
      </header>
      {entries.map((entry) => (
        <Row key={entry.slide.id} entry={entry} />
      ))}
    </main>
  );
}
