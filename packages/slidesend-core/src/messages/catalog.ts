import type { Messages } from "../nodes/types";

/**
 * A message catalog of a package or plugin (spec §6.5): keyed strings per language, with named
 * placeholders in braces. English is required; a talk in another language falls back to it.
 */
export function defineMessages<const Catalog extends Messages & { en: Record<string, string> }>(
  catalog: Catalog,
): Catalog {
  return catalog;
}

/** Fills `{name}` placeholders; an unknown placeholder stays as it is, so nothing disappears. */
export function formatMessage(text: string, values: Record<string, unknown> = {}): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Looks up one UI string; `key` is a key of a catalog, e.g. `core.view.unavailable`. */
export type Text = (key: string, values?: Record<string, unknown>) => string;

/** The languages to try for a talk, most specific first, English last (spec §6.5). */
export function languageChain(language: string): string[] {
  const tags = language
    .split("-")
    .reduce<string[]>((all, part) => [...all, all.length ? `${all.at(-1)}-${part}` : part], []);
  return [...tags.reverse(), "en"].filter((tag, index, all) => all.indexOf(tag) === index);
}

/** One problem with the UI strings of a presentation. */
export interface MessageProblem {
  key: string;
  message: string;
}

/** Everything `createText` takes. */
export interface TextOptions {
  /** The talk's language, from `meta.language`. */
  language: string;
  /** The catalogs of core and of every installed plugin. */
  catalogs: readonly Messages[];
  /** The talk's own overrides, by language (spec §6.5). */
  overrides?: Messages;
}

/**
 * Builds the lookup for UI strings: the talk's overrides win, then the catalogs in the talk's
 * language, then English. Overriding a key that no catalog has is reported, so that a renamed
 * key is noticed instead of silently ignored.
 */
export function createText(options: TextOptions): { text: Text; problems: MessageProblem[] } {
  const chain = languageChain(options.language);
  const known = new Set<string>();
  for (const catalog of options.catalogs) {
    for (const strings of Object.values(catalog)) {
      for (const key of Object.keys(strings)) known.add(key);
    }
  }

  const problems: MessageProblem[] = [];
  for (const [language, strings] of Object.entries(options.overrides ?? {})) {
    for (const key of Object.keys(strings)) {
      if (!known.has(key)) {
        problems.push({
          key,
          message: `messages.${language}.${key}: no installed package has a message with the key "${key}".`,
        });
      }
    }
  }

  const sources = [options.overrides ?? {}, ...options.catalogs];
  const text: Text = (key, values) => {
    for (const language of chain) {
      for (const source of sources) {
        const found = source[language]?.[key];
        if (found !== undefined) return formatMessage(found, values);
      }
    }
    return key;
  };
  return { text, problems };
}

/** Every key a catalog defines, in order, for the generated reference. */
export function messageKeys(catalog: Messages): string[] {
  return Object.keys(catalog.en ?? {}).sort();
}
