/**
 * The desk's colours: the slidesend dark theme (nxsflow/brand, `tokens/slidesend.css`), because
 * the speaker works in a dark room. The start page, presenting and the review share it. The desk
 * is not themeable beyond the chapter accents (spec §2), so its colours are literal here, and
 * here only: slidesend-allow-literal-styles.
 *
 * Spotlight is the one lit thing per view: the primary action. The status colours (good, cue,
 * bad and the clock's tones) say how the talk is going and are never used for decoration.
 */
export const palette = {
  /** Ink: the page. */
  page: "#17151F",
  /** The raised surface: cards, panels, menus, fields. */
  panel: "#211E2B",
  /** Hairlines and borders. */
  line: "#36323F",
  /** Paper: the text the speaker reads. */
  text: "#F7F5F2",
  /** Secondary text, a step down from paper. */
  soft: "#D4D1D9",
  /** Labels and hints. */
  muted: "#A1A1AA",
  /** Spotlight: the primary action of the view. */
  primary: "#F04E23",
  /** Ink on spotlight. */
  onPrimary: "#17151F",
  /** In control, ahead of plan. */
  good: "#4ADE80",
  /** The quiet ground behind a good state. */
  goodWash: "#14301F",
  /** A cue for the speaker, on time. */
  cue: "#FFBB45",
  /** The quiet ground behind a warning or a cue. */
  warnWash: "#3A2A12",
  /** Behind plan. */
  behind: "#FF9A3D",
  /** Wrong, late, live, or destructive. */
  bad: "#F87171",
} as const;

/** The clock's colour for how the talk stands against its plan. */
export const toneColor = {
  ahead: palette.good,
  onTime: palette.cue,
  behind: palette.behind,
  late: palette.bad,
} as const;
