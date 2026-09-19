import type { z } from "zod";
import type { Plugin, SlideNodeOf } from "../nodes/define";
import { createRegistry, formatNodePath, type Registry } from "../nodes/registry";
import type { NodeIssue, ReferenceCheck } from "../nodes/slots";
import type { Messages, SlideNode, StepDescription } from "../nodes/types";
import { chapterSchema, type Deck, metaSchema } from "./deck";

/**
 * A design (spec §7): exactly one per presentation. This is the part `definePresentation` needs;
 * the design contract adds tokens, fonts and frames.
 */
export interface Design {
  readonly name: string;
}

/**
 * A hosting platform (spec §8): at most one per presentation. Without one, the talk runs in local
 * mode. This is the part `definePresentation` needs; the platform contract adds the rest.
 */
export interface Platform {
  readonly name: string;
}

/** Everything `definePresentation` takes (spec §4.1). */
export interface PresentationConfig<Plugins extends readonly Plugin[]> {
  /** The deck. Every slide type in it must come from one of `plugins`. */
  deck: Deck<NoInfer<SlideNodeOf<Plugins>>>;
  /** The design. */
  design: Design;
  /** The hosting platform; omit it to run in local mode. */
  platform?: Platform;
  /** The installed plugins, wired by explicit composition (spec D4). */
  plugins: Plugins;
  /** Overrides of UI strings, by language (spec §6.5). */
  messages?: Messages;
}

/** A slide after validation, with its resolved id. */
export interface ResolvedSlide {
  /** The slide's stable id: its own `id`, or derived from chapter and position. */
  id: string;
  /** Position in `deck.slides`, from 0. */
  index: number;
  /** The id of the slide's chapter. */
  chapter: string;
  /** The slide node after validation, with defaults applied. */
  node: SlideNode;
  /** The label from the slide's `describe`. */
  label: string;
  /** Position of the slide's first step in `Presentation.steps`. */
  firstStep: number;
  /** The slide's step count. */
  stepCount: number;
}

/**
 * One step of the whole deck, in order (spec §13). Everything else in the tool reads this list:
 * navigation, desk, phones, timing, print and storyboard.
 */
export interface DeckStep extends StepDescription {
  /** Position in the whole deck, from 0. */
  index: number;
  /** The id of the slide this step belongs to. */
  slideId: string;
  /** Position of that slide in `deck.slides`, from 0. */
  slideIndex: number;
  /** Position of the step within its slide, from 0. */
  step: number;
  /** The id of the slide's chapter. */
  chapter: string;
  /** The slide's label. */
  label: string;
  /** Planned minutes before this step starts: the sum of `minutes` of all earlier steps. */
  startMinutes: number;
}

/** A validated presentation: the deck resolved into slides and steps, plus the configuration. */
export interface Presentation {
  meta: z.output<typeof metaSchema>;
  chapters: z.output<typeof chapterSchema>[];
  slides: ResolvedSlide[];
  steps: DeckStep[];
  /** The planned length of the deck: the sum of `minutes` over all steps. */
  plannedMinutes: number;
  registry: Registry;
  plugins: readonly Plugin[];
  design: Design;
  platform?: Platform;
  messages: Messages;
}

/** One problem found in a deck. */
export interface DeckIssue {
  /** Where in the deck: `meta`, `chapters[1]`, or a slide such as `slide "intro-2" (slides[3])`. */
  where: string;
  /** The field path within that place. */
  path: PropertyKey[];
  message: string;
}

/** Thrown when a deck does not pass validation; `issues` holds every problem found. */
export class DeckValidationError extends Error {
  readonly issues: readonly DeckIssue[];

  constructor(issues: readonly DeckIssue[]) {
    const lines = issues.map(({ where, path, message }) => {
      const field = formatNodePath(path);
      return `  ${where}${field ? ` ${field}` : ""}: ${message}`;
    });
    super(`The deck has ${issues.length} problem(s):\n${lines.join("\n")}`);
    this.name = "DeckValidationError";
    this.issues = issues;
  }
}

/**
 * Defines the presentation (spec §4.1) and validates the deck against the installed plugins
 * (spec §5.2): every node passes its schema, slide ids are unique, every chapter and reference
 * resolves, and every node type is installed. Throws a `DeckValidationError` naming each problem
 * by slide id and field path. On success it returns the deck resolved into slides and a flat
 * list of steps with planned minutes.
 */
export function definePresentation<const Plugins extends readonly Plugin[]>(
  config: PresentationConfig<Plugins>,
): Presentation {
  const { deck, plugins } = config;
  const registry = createRegistry(plugins);
  const issues: DeckIssue[] = [];
  const add = (where: string) => (list: readonly NodeIssue[]) => {
    for (const { path, message } of list) issues.push({ where, path, message });
  };

  const meta = metaSchema.safeParse(deck.meta);
  if (!meta.success) add("meta")(meta.error.issues);

  const chapterIds = new Set<string>();
  const chapters: z.output<typeof chapterSchema>[] = [];
  deck.chapters.forEach((chapter, index) => {
    const result = chapterSchema.safeParse(chapter);
    if (!result.success) {
      add(`chapters[${index}]`)(result.error.issues);
      return;
    }
    if (chapterIds.has(result.data.id)) {
      add(`chapters[${index}]`)([
        { path: ["id"], message: `Duplicate chapter id "${result.data.id}".` },
      ]);
    }
    chapterIds.add(result.data.id);
    chapters.push(result.data);
  });

  // Slide ids first: references to slides may point forward.
  const perChapter = new Map<string, number>();
  const firstWithId = new Map<string, number>();
  const slideIds: (string | undefined)[] = [];
  const where: string[] = [];
  deck.slides.forEach((slide, index) => {
    const chapter = (slide as { chapter?: unknown }).chapter;
    const position = typeof chapter === "string" ? (perChapter.get(chapter) ?? 0) + 1 : 0;
    if (typeof chapter === "string") perChapter.set(chapter, position);
    const own = (slide as { id?: unknown }).id;
    const id =
      typeof own === "string" && own
        ? own
        : typeof chapter === "string"
          ? `${chapter}-${position}`
          : undefined;
    slideIds.push(id);
    where.push(id ? `slide "${id}" (slides[${index}])` : `slides[${index}]`);

    if (typeof chapter === "string" && chapter && !chapterIds.has(chapter)) {
      add(where[index] as string)([
        { path: ["chapter"], message: `No chapter has the id "${chapter}".` },
      ]);
    }
    if (id !== undefined) {
      const first = firstWithId.get(id);
      if (first !== undefined) {
        add(where[index] as string)([
          { path: ["id"], message: `Duplicate slide id "${id}"; slides[${first}] has it too.` },
        ]);
      } else firstWithId.set(id, index);
    }
  });

  // First pass: validate every slide and collect the activity ids its steps declare.
  const activityIds = new Map<string, number>();
  const valid = new Set<number>();
  deck.slides.forEach((slide, index) => {
    const result = registry.safeParse("slide", slide);
    if (!result.ok) {
      add(where[index] as string)(result.issues);
      return;
    }
    valid.add(index);
    for (const step of registry.describe(result.value).steps) {
      const id = (step.activity as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string") continue;
      const first = activityIds.get(id);
      if (first !== undefined && first !== index) {
        add(where[index] as string)([
          { path: [], message: `Duplicate activity id "${id}"; ${where[first]} declares it too.` },
        ]);
      } else activityIds.set(id, index);
    }
  });

  // Second pass: every slide that passed is parsed again, now with its references checked.
  const provided = new Map<string, Set<string>>();
  for (const plugin of plugins) {
    for (const [kind, ids] of Object.entries(plugin.provides)) {
      const set = provided.get(kind) ?? new Set<string>();
      for (const id of ids) set.add(id);
      provided.set(kind, set);
    }
  }
  const reference: ReferenceCheck = (kind, id) => {
    if (kind === "slide") return firstWithId.has(id) ? undefined : `No slide has the id "${id}".`;
    if (kind === "activity") {
      return activityIds.has(id) ? undefined : `No activity has the id "${id}".`;
    }
    const ids = provided.get(kind);
    if (!ids) return `No installed plugin provides references of the kind "${kind}".`;
    return ids.has(id) ? undefined : `No installed plugin provides the ${kind} "${id}".`;
  };
  const nodes = new Map<number, SlideNode>();
  for (const index of valid) {
    const result = registry.safeParse("slide", deck.slides[index], { reference });
    if (result.ok) nodes.set(index, result.value);
    else add(where[index] as string)(result.issues);
  }

  if (issues.length > 0 || !meta.success) throw new DeckValidationError(issues);

  const slides: ResolvedSlide[] = [];
  const steps: DeckStep[] = [];
  let minutes = 0;
  deck.slides.forEach((_, index) => {
    const node = nodes.get(index) as SlideNode;
    const { label, steps: described } = registry.describe(node);
    const slide: ResolvedSlide = {
      id: slideIds[index] as string,
      index,
      chapter: node.chapter,
      node,
      label,
      firstStep: steps.length,
      stepCount: described.length,
    };
    slides.push(slide);
    described.forEach((description, step) => {
      steps.push({
        ...description,
        index: steps.length,
        slideId: slide.id,
        slideIndex: index,
        step,
        chapter: slide.chapter,
        label,
        startMinutes: minutes,
      });
      minutes += description.minutes ?? 0;
    });
  });

  return {
    meta: meta.data,
    chapters,
    slides,
    steps,
    plannedMinutes: minutes,
    registry,
    plugins,
    design: config.design,
    platform: config.platform,
    messages: config.messages ?? {},
  };
}
