import {
  accentVariable,
  cssVariable,
  defineDesign,
  type PhoneFrameProps,
  type StageFrameProps,
  useText,
} from "@nxsflow/slidesend-core";
import { defaultTokens } from "./design-tokens";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;
const accent = `var(${accentVariable})`;

/** Stage chrome: an empty logo slot and a progress bar in the chapter's accent. */
function StageFrame({ progress, frame, children }: StageFrameProps) {
  return (
    <>
      {children}
      <div
        data-logo-slot
        data-large={frame.heroTitle ? true : undefined}
        style={{ position: "absolute", top: 48, right: 64, width: 160, height: 56 }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 9,
          background: color("border"),
        }}
      />
      <div
        data-progress
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 9,
          width: `${((progress.index + 1) / Math.max(1, progress.total)) * 100}%`,
          background: accent,
          transition: "width 500ms ease-out",
        }}
      />
    </>
  );
}

/** Phone chrome: the chapter in its accent above the content, and a quiet footer line. */
function PhoneFrame({ chapter, children }: PhoneFrameProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: color("background"),
      }}
    >
      <header
        style={{
          padding: "16px 20px",
          borderBottom: `3px solid ${accent}`,
          color: accent,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {chapter?.title ?? " "}
      </header>
      <main style={{ flex: 1, padding: 20, color: color("text") }}>{children}</main>
      <footer style={{ padding: "12px 20px", borderTop: `1px solid ${color("border")}` }} />
    </div>
  );
}

const page = { padding: 24, color: color("text"), textAlign: "center" as const };

/**
 * The neutral default design (spec §7): system fonts, a restrained palette with four chapter
 * accents, an empty logo slot, a progress bar, and plain phone pages. To keep its frames and
 * change only colors, spread it: `defineDesign({ ...defaultDesign, name, tokens })`.
 */
export const defaultDesign = defineDesign({
  name: "default",
  tokens: defaultTokens,
  leaveMs: 820,
  StageFrame,
  PhoneFrame,
  StartPage: ({ title, subtitle }) => {
    const text = useText();
    return (
      <div data-page="start" style={page}>
        <h1 style={{ fontFamily: `var(${cssVariable("font", "display")})` }}>{title}</h1>
        {subtitle && <p style={{ color: color("textMuted") }}>{subtitle}</p>}
        <p style={{ color: color("textMuted") }}>{text("basics.phone.waiting")}</p>
      </div>
    );
  },
  ClosedPage: ({ title }) => {
    const text = useText();
    return (
      <div data-page="closed" style={page}>
        <p>{text("basics.phone.thanks", { title })}</p>
      </div>
    );
  },
  IdlePage: () => {
    const text = useText();
    return (
      <div data-page="idle" style={page}>
        <p style={{ color: color("textMuted") }}>{text("basics.phone.idle")}</p>
      </div>
    );
  },
});
