import type { DesignTokens } from "@slidesend/core";

/**
 * The token values of the default design: a restrained light palette, four chapter accents that
 * stay apart on a projector, and system font stacks, so nothing is downloaded.
 */
export const defaultTokens: DesignTokens = {
  base: {
    color: {
      background: "#f7f7f4",
      surface: "#ffffff",
      text: "#1c1d21",
      textMuted: "#5d616b",
      primary: "#2f5bd3",
      onPrimary: "#ffffff",
      border: "#d8d9d4",
      positive: "#1f8a5b",
      negative: "#c2372b",
      focus: "#e0a100",
    },
    font: {
      display: "ui-serif, Georgia, 'Times New Roman', serif",
      sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    },
    radius: { small: "8px", large: "16px" },
    accents: ["#2f5bd3", "#c2410c", "#0f766e", "#7e22ce"],
  },
};
