import { accentVariable, cssVariable, defineDesign } from "@nxsflow/slidesend-core";
import { tokens } from "./tokens";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;
const display = `var(${cssVariable("font", "display")})`;
const accent = `var(${accentVariable})`;

/**
 * This talk's design: the tokens from tokens.ts, plus the frames around stage and phone and the
 * three pages a phone shows when no question is running. Replace public/logo.svg (stage) and public/logo-mark.svg (phones) with your own.
 */
// snippet: design
export const starterDesign = defineDesign({
  name: "starter",
  tokens,
  StageFrame: ({ progress, frame, children }) => (
    <>
      {children}
      {/* The logo is large while a hero title is centered, small otherwise. */}
      <img
        src="/logo.svg"
        alt=""
        style={{
          position: "absolute",
          top: 48,
          right: 64,
          height: frame.heroTitle ? 120 : 56,
          transition: "height 600ms",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 10,
          width: `${((progress.index + 1) / progress.total) * 100}%`,
          background: accent,
          transition: "width 400ms",
        }}
      />
    </>
  ),
  PhoneFrame: ({ chapter, children }) => (
    <div style={{ minHeight: "100dvh", padding: 20, color: color("text") }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <img src="/logo-mark.svg" alt="" style={{ height: 28 }} />
        {chapter && <span style={{ color: accent, fontWeight: 600 }}>{chapter.title}</span>}
      </header>
      {children}
    </div>
  ),
  StartPage: ({ title }) => (
    <div style={{ textAlign: "center", paddingTop: 48 }}>
      <h1 style={{ fontFamily: display }}>{title}</h1>
      <p style={{ color: color("textMuted") }}>Questions appear here during the talk.</p>
    </div>
  ),
  ClosedPage: ({ title }) => <p>Thank you for joining “{title}”.</p>,
  IdlePage: () => <p style={{ color: color("textMuted") }}>No talk is running right now.</p>,
});
// end snippet
