import { cssVariable, defineDesign } from "@slidesend/core";

const accent = `var(--slidesend-accent)`;

/** The example talk's own design: a calm night sky, with one accent per chapter. */
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
  PhoneFrame: ({ children }) => <>{children}</>,
  StartPage: ({ title }) => <h1>{title}</h1>,
  ClosedPage: ({ title }) => <p>Thanks for joining “{title}”.</p>,
  IdlePage: () => <p>Nothing is happening right now.</p>,
});

/** Colors of the design, for components that need a token by name. */
export const token = {
  text: `var(${cssVariable("color", "text")})`,
  muted: `var(${cssVariable("color", "textMuted")})`,
  display: `var(${cssVariable("font", "display")})`,
  accent,
};
