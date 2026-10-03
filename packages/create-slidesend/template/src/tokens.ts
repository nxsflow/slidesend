import type { DesignTokens } from "@nxsflow/slidesend-core";

/**
 * The values of this talk's design. Every template, block and activity reads them as CSS
 * variables, so changing a color here changes it everywhere. The full list of tokens is in
 * node_modules/@nxsflow/slidesend-core/docs/tokens.md.
 */
export const tokens: DesignTokens = {
  base: {
    // snippet: colors
    color: {
      background: "#fbf7f0",
      surface: "#f1e9dc",
      text: "#2b2118",
      textMuted: "#7a6a5a",
      primary: "#c4532d",
      onPrimary: "#fbf7f0",
      border: "#dccfbd",
      positive: "#3f8f5b",
      negative: "#b93a3a",
      focus: "#e3a33b",
    },
    // end snippet
    font: {
      display: "Georgia, 'Times New Roman', serif",
      sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      mono: "Menlo, Consolas, 'DejaVu Sans Mono', ui-monospace, monospace",
    },
    radius: { small: "6px", large: "16px" },
    // snippet: accents
    // One accent per chapter, by position; they repeat when there are more chapters.
    accents: ["#c4532d", "#3f7f8f", "#8a5aa8", "#3f8f5b"],
    // end snippet
  },
  // The phones get a darker background than the stage.
  phone: { color: { background: "#2b2118", surface: "#3a2e23", text: "#fbf7f0" } },
};
