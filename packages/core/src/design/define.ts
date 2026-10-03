import type { ComponentType, ReactNode } from "react";
import { z } from "zod";
import type { FrameHints } from "../nodes/types";
import { type ColorToken, colorTokens, type FontToken, fontTokens, radiusTokens } from "./tokens";

/** Color values by token, as CSS colors. */
export type ColorValues = Record<ColorToken, string>;

/** The tokens of a design (spec §7): a complete base, and partial color overrides per surface. */
export interface DesignTokens {
  base: {
    color: ColorValues;
    /** Font stacks by token, e.g. `"Inter, system-ui, sans-serif"`. */
    font: Record<FontToken, string>;
    /** Radii by token, as CSS lengths. */
    radius: Record<keyof typeof radiusTokens, string>;
    /** Chapter accent colors, assigned by chapter position. */
    accents: readonly string[];
  };
  /** Colors that differ on the stage. */
  stage?: { color?: Partial<ColorValues> };
  /** Colors that differ on the phones. */
  phone?: { color?: Partial<ColorValues> };
}

/** One font file for `@font-face`. */
export interface FontFile {
  family: string;
  /** The file's URL, e.g. `/brand/display.woff2`. */
  src: string;
  /** A weight, or a range for a variable font, e.g. `400` or `"100 900"`. */
  weight: number | string;
  style?: "normal" | "italic";
}

/** Progress through the deck, as the stage frame shows it. */
export interface StageProgress {
  /** The current step, from 0. */
  index: number;
  /** All steps of the deck. */
  total: number;
  /** The current chapter's position, from 0. */
  chapterIndex: number;
  /** The current chapter's title. */
  chapterTitle: string;
}

/** Props of the stage chrome: logo positions, progress bar and whatever the design adds. */
export interface StageFrameProps {
  progress: StageProgress;
  /** Hints from the current step's `describe`, e.g. a large logo while a hero title shows. */
  frame: FrameHints;
  /** The slide. */
  children: ReactNode;
}

/** Props of the phone chrome: header with logo and chapter, footer line. */
export interface PhoneFrameProps {
  /** The current chapter, while a session is open. */
  chapter?: { title: string; index: number };
  children: ReactNode;
}

/** Props of the page phones show while a session is open and no activity runs yet. */
export interface StartPageProps {
  title: string;
  subtitle?: string;
}

/** Props of the page phones show after a session closed. */
export interface ClosedPageProps {
  title: string;
  /** The session's name. */
  sessionName?: string;
}

/** Props of the page phones show when there is no session at all. */
export type IdlePageProps = Record<string, never>;

/** Everything `defineDesign` takes (spec §7). */
export interface Design {
  /** The design's name. */
  name: string;
  tokens: DesignTokens;
  /** Font files; without them, the font stacks in the tokens apply as they are. */
  fonts?: readonly FontFile[];
  /** How long a leaving slide stays mounted by default, in ms. */
  leaveMs?: number;
  StageFrame: ComponentType<StageFrameProps>;
  PhoneFrame: ComponentType<PhoneFrameProps>;
  StartPage: ComponentType<StartPageProps>;
  ClosedPage: ComponentType<ClosedPageProps>;
  IdlePage: ComponentType<IdlePageProps>;
}

const value = z.string().trim().min(1);
const shape = (names: object) =>
  z.object(Object.fromEntries(Object.keys(names).map((name) => [name, value])));
const partialShape = (names: object) => shape(names).partial().strict();

const tokensSchema = z.object({
  base: z.object({
    color: shape(colorTokens),
    font: shape(fontTokens),
    radius: shape(radiusTokens),
    accents: z.array(value).min(1),
  }),
  stage: z
    .object({ color: partialShape(colorTokens).optional() })
    .strict()
    .optional(),
  phone: z
    .object({ color: partialShape(colorTokens).optional() })
    .strict()
    .optional(),
});

const fontSchema = z.object({
  family: value,
  src: value,
  weight: z.union([z.number().int().min(1).max(1000), value]),
  style: z.enum(["normal", "italic"]).optional(),
});

const components = ["StageFrame", "PhoneFrame", "StartPage", "ClosedPage", "IdlePage"] as const;

/**
 * Defines a design (spec §7). Throws if a required token or component is missing, naming each
 * one, e.g. `tokens.base.color.focus`. To change only some tokens of an existing design, spread
 * it: `defineDesign({ ...defaultDesign, name: "mine", tokens: { ... } })`.
 */
export function defineDesign(design: Design): Design {
  const problems: string[] = [];
  const tokens = tokensSchema.safeParse(design.tokens);
  if (!tokens.success) {
    for (const issue of tokens.error.issues) {
      const path = ["tokens", ...issue.path].join(".");
      problems.push(
        issue.code === "invalid_type" && issue.input === undefined
          ? `missing ${path}`
          : `${path}: ${issue.message}`,
      );
    }
  }
  (design.fonts ?? []).forEach((font, index) => {
    const result = fontSchema.safeParse(font);
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`fonts[${index}].${issue.path.join(".")}: ${issue.message}`);
      }
    }
  });
  for (const component of components) {
    const value = design[component] as unknown;
    if (!value || (typeof value !== "function" && typeof value !== "object")) {
      problems.push(`missing ${component}`);
    }
  }
  if (!design.name) problems.push("missing name");
  if (problems.length > 0) {
    throw new Error(
      `The design "${design.name ?? ""}" is incomplete:\n${problems.map((p) => `  ${p}`).join("\n")}`,
    );
  }
  return design;
}
