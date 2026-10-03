import { z } from "zod";
import type { SlideNode } from "../nodes/types";

/** The schema of a deck's `meta` (spec §5). */
export const metaSchema = z.object({
  /** The talk's title. */
  title: z.string().min(1),
  /** An optional subtitle. */
  subtitle: z.string().optional(),
  /** Who gives the talk. */
  author: z.string().optional(),
  /** The language of the talk as a BCP 47 tag, e.g. `"en"` or `"de-DE"`. It selects UI strings. */
  language: z.string().min(2),
  /** The planned length of the talk in minutes; a session's default length. */
  plannedMinutes: z.number().positive().optional(),
});

/** The schema of one chapter (spec §5). */
export const chapterSchema = z.object({
  /** A stable id that slides refer to with `chapter`. */
  id: z.string().min(1),
  /** The chapter's title. */
  title: z.string().min(1),
  /** A short label for tabs and overlays; defaults to the title. */
  tab: z.string().optional(),
  /** One sentence that sums up the chapter. */
  claim: z.string().optional(),
  /** The planned length of the chapter in minutes. */
  minutes: z.number().nonnegative().optional(),
});

/** A deck's meta data, as written in a deck. */
export type Meta = z.input<typeof metaSchema>;

/** A chapter, as written in a deck. A chapter's accent color comes from the design, by position. */
export type Chapter = z.input<typeof chapterSchema>;

/**
 * A deck (spec §5): meta data, chapters and slides. There are no clock times in a deck; time is
 * expressed as `minutes`, and clock times belong to a session.
 */
export interface Deck<Slide extends SlideNode = SlideNode> {
  meta: Meta;
  chapters: readonly Chapter[];
  slides: readonly Slide[];
}

/**
 * Defines a deck. It keeps the types of the slides, so that `definePresentation` can check at
 * compile time that every slide type comes from an installed plugin. The deck is validated when
 * the presentation loads, because only the presentation knows the installed plugins.
 */
export function defineDeck<Slide extends SlideNode>(deck: Deck<Slide>): Deck<Slide> {
  return deck;
}
