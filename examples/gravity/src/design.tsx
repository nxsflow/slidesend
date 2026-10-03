import { cssVariable, defineDesign } from "@nxsflow/slidesend-core";

const accent = `var(--slidesend-accent)`;

/** The example talk's own design: a calm night sky, with one accent per chapter. */
// snippet: define-design
export const gravityDesign = defineDesign({
  name: "gravity",
  tokens: {
    base: {
      color: {
        background: "#0b1020",
        surface: "#151c33",
        text: "#eef1f8",
        textMuted: "#9aa3b8",
        primary: "#7aa2ff",
        onPrimary: "#0b1020",
        border: "#2a3350",
        positive: "#5fd39a",
        negative: "#ff7a7a",
        focus: "#ffd166",
      },
      font: {
        display: "Georgia, 'Times New Roman', serif",
        sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        mono: "ui-monospace, 'SF Mono', Menlo, monospace",
      },
      radius: { small: "6px", large: "18px" },
      accents: ["#7aa2ff", "#ffd166", "#5fd39a"],
    },
    phone: { color: { background: "#10162b" } },
  },
  StageFrame: ({ progress, children }) => (
    <>
      {children}
      <div
        data-progress
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 8,
          width: `${((progress.index + 1) / progress.total) * 100}%`,
          background: accent,
          transition: "width 400ms ease-out",
        }}
      />
    </>
  ),
  PhoneFrame: ({ chapter, children }) => (
    <div style={{ minHeight: "100dvh", padding: 20, color: token.text }}>
      {chapter && (
        <header style={{ color: accent, fontWeight: 600, marginBottom: 16 }}>
          {chapter.title}
        </header>
      )}
      {children}
    </div>
  ),
  StartPage: ({ title, subtitle }) => (
    <div data-page="start">
      <h1 style={{ fontFamily: token.display }}>{title}</h1>
      {subtitle && <p style={{ color: token.muted }}>{subtitle}</p>}
      <p style={{ color: token.muted }}>Questions appear here.</p>
    </div>
  ),
  ClosedPage: ({ title }) => <p data-page="closed">Thanks for joining “{title}”.</p>,
  IdlePage: () => <p data-page="idle">Nothing is happening right now.</p>,
});
// end snippet

/** Colors of the design, for components that need a token by name. */
export const token = {
  text: `var(${cssVariable("color", "text")})`,
  muted: `var(${cssVariable("color", "textMuted")})`,
  display: `var(${cssVariable("font", "display")})`,
  accent,
};
