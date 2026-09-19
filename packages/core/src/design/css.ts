import type { Presentation } from "../deck/presentation";
import type { Design, FontFile, StageFrameProps } from "./define";
import {
  accentVariable,
  accentVariableAt,
  colorTokens,
  cssVariable,
  fontTokens,
  radiusTokens,
  type Surface,
} from "./tokens";

/** The accent of the chapter at `chapterIndex`; accents repeat when chapters outnumber them. */
export function chapterAccent(design: Design, chapterIndex: number): string {
  const { accents } = design.tokens.base;
  const position = ((chapterIndex % accents.length) + accents.length) % accents.length;
  return accents[position] as string;
}

/**
 * The CSS variables core writes onto a surface's root element (spec §7). Stage and phone get
 * every token, with the surface's color overrides winning over the base; the desk gets the
 * chapter accents only. `chapterIndex` sets `--slidesend-accent` to the current chapter's.
 */
export function surfaceVariables(
  design: Design,
  surface: Surface,
  chapterIndex = 0,
): Record<string, string> {
  const { base } = design.tokens;
  const variables: Record<string, string> = {};
  base.accents.forEach((accent, index) => {
    variables[accentVariableAt(index + 1)] = accent;
  });
  variables[accentVariable] = chapterAccent(design, chapterIndex);
  if (surface === "desk") return variables;

  const overrides = design.tokens[surface]?.color ?? {};
  for (const name of Object.keys(colorTokens) as (keyof typeof colorTokens)[]) {
    variables[cssVariable("color", name)] = overrides[name] ?? base.color[name];
  }
  for (const name of Object.keys(fontTokens) as (keyof typeof fontTokens)[]) {
    variables[cssVariable("font", name)] = base.font[name];
  }
  for (const name of Object.keys(radiusTokens) as (keyof typeof radiusTokens)[]) {
    variables[cssVariable("radius", name)] = base.radius[name];
  }
  return variables;
}

const formats: Record<string, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

const quoted = (text: string) => `"${text.replace(/["\\]/g, "\\$&")}"`;

/**
 * `@font-face` rules for the design's font files. `font-display: swap` shows the fallback stack
 * at once, so a missing file never hides text.
 */
export function fontFaceCss(fonts: readonly FontFile[] = []): string {
  return fonts
    .map((font) => {
      const extension = font.src.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
      const format = formats[extension];
      return [
        "@font-face {",
        `  font-family: ${quoted(font.family)};`,
        `  src: url(${quoted(font.src)})${format ? ` format(${quoted(format)})` : ""};`,
        `  font-weight: ${font.weight};`,
        `  font-style: ${font.style ?? "normal"};`,
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n");
}

/** What the design's `StageFrame` receives at a step: progress, frame hints and nothing else. */
export function stageFrameProps(
  presentation: Presentation,
  stepIndex: number,
): Omit<StageFrameProps, "children"> {
  const step = presentation.steps[stepIndex];
  if (!step) throw new Error(`The deck has no step ${stepIndex}.`);
  const chapterIndex = presentation.chapters.findIndex((chapter) => chapter.id === step.chapter);
  return {
    progress: {
      index: stepIndex,
      total: presentation.steps.length,
      chapterIndex,
      chapterTitle: presentation.chapters[chapterIndex]?.title ?? "",
    },
    frame: step.frame ?? {},
  };
}
