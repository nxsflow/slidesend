/**
 * The fixed list of design tokens (spec §7). This list is the contract between a design and
 * everything that renders: templates, blocks and activities use these tokens only, as CSS
 * variables, never a literal color or font.
 */
export const colorTokens = {
  background: "The page behind everything on the surface.",
  surface: "Cards, panels and other raised areas.",
  text: "Body text and icons.",
  textMuted: "Secondary text, captions and hints.",
  primary: "Interactive elements and highlights, e.g. buttons.",
  onPrimary: "Text and icons on `primary`.",
  border: "Lines and outlines.",
  positive: "Success and agreement, e.g. a correct answer.",
  negative: "Errors and disagreement.",
  focus: "The keyboard focus ring.",
} as const;

/** Font tokens. Fonts apply on every surface. */
export const fontTokens = {
  display: "Titles and large statements.",
  sans: "Body text and interface.",
  mono: "Code and numbers that must line up.",
} as const;

/** Radius tokens. */
export const radiusTokens = {
  small: "Buttons, inputs and small elements.",
  large: "Cards and panels.",
} as const;

/** The name of a color token. */
export type ColorToken = keyof typeof colorTokens;
/** The name of a font token. */
export type FontToken = keyof typeof fontTokens;
/** The name of a radius token. */
export type RadiusToken = keyof typeof radiusTokens;

/** The surfaces a design styles. The desk takes only the chapter accents (spec §7). */
export type Surface = "stage" | "phone" | "desk";

const prefix = "--slidesend";

/** The CSS variable of a token, e.g. `cssVariable("color", "text")` → `--slidesend-color-text`. */
export function cssVariable(kind: "color" | "font" | "radius", name: string): string {
  return `${prefix}-${kind}-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** The CSS variable of the current chapter's accent. */
export const accentVariable = `${prefix}-accent`;

/** The CSS variable of the n-th accent, from 1. */
export const accentVariableAt = (position: number) => `${prefix}-accent-${position}`;

/** One row of the token reference. */
export interface TokenReference {
  token: string;
  variable: string;
  surfaces: string;
  description: string;
}

/** Every token with its CSS variable, where it applies and what it is for. */
export function tokenReference(): TokenReference[] {
  return [
    ...Object.entries(colorTokens).map(([name, description]) => ({
      token: `color.${name}`,
      variable: cssVariable("color", name),
      surfaces: "stage, phone (each may override)",
      description,
    })),
    ...Object.entries(fontTokens).map(([name, description]) => ({
      token: `font.${name}`,
      variable: cssVariable("font", name),
      surfaces: "stage, phone",
      description,
    })),
    ...Object.entries(radiusTokens).map(([name, description]) => ({
      token: `radius.${name}`,
      variable: cssVariable("radius", name),
      surfaces: "stage, phone",
      description,
    })),
    {
      token: "accents",
      variable: `${accentVariable}, ${accentVariableAt(1)} … ${accentVariableAt(3)} …`,
      surfaces: "stage, phone, desk",
      description:
        "Chapter accent colors, assigned by chapter position and repeated when there are more chapters than accents. `--slidesend-accent` is the current chapter's.",
    },
  ];
}

/** The token reference as a Markdown table, for the docs. */
export function tokenReferenceTable(): string {
  const rows = tokenReference().map(
    ({ token, variable, surfaces, description }) =>
      `| \`${token}\` | \`${variable}\` | ${surfaces} | ${description} |`,
  );
  return ["| Token | CSS variable | Surfaces | Purpose |", "|---|---|---|---|", ...rows, ""].join(
    "\n",
  );
}
