import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  coreMessages,
  createText,
  DeckValidationError,
  defineDeck,
  defineMessages,
  definePlugin,
  definePresentation,
  defineSlide,
  formatMessage,
  languageChain,
  messageKeys,
} from "../index";
import { plainDesign } from "../testing";

const slide = defineSlide({
  type: "plain",
  schema: z.object({ title: z.string() }),
  Component: () => null,
});
const pollMessages = defineMessages({
  en: { "poll.submit": "Send", "poll.thanks": "Thanks, {name}!" },
  de: { "poll.submit": "Absenden" },
});
const plugin = definePlugin({ name: "poll", slides: [slide], messages: pollMessages });

const present = (language: string, messages?: Record<string, Record<string, string>>) =>
  definePresentation({
    deck: defineDeck({
      meta: { title: "Gravity", language },
      chapters: [{ id: "c", title: "C" }],
      slides: [slide({ chapter: "c", title: "t" })],
    }),
    design: plainDesign,
    plugins: [plugin],
    ...(messages ? { messages } : {}),
  });

describe("languages", () => {
  it("try the most specific tag first and end at English", () => {
    expect(languageChain("de-DE")).toEqual(["de-DE", "de", "en"]);
    expect(languageChain("en")).toEqual(["en"]);
    expect(languageChain("pt-BR")).toEqual(["pt-BR", "pt", "en"]);
  });
});

describe("placeholders", () => {
  it("are filled by name, and left alone when nothing matches", () => {
    expect(formatMessage("Thanks, {name}!", { name: "Ada" })).toBe("Thanks, Ada!");
    expect(formatMessage("Thanks, {name}!")).toBe("Thanks, {name}!");
    expect(formatMessage("{a} and {b}", { a: 1, b: true })).toBe("1 and true");
  });
});

describe("lookup", () => {
  it("falls back to English for a language a catalog does not have", () => {
    const { text } = createText({ language: "de-DE", catalogs: [pollMessages] });
    expect(text("poll.submit")).toBe("Absenden");
    expect(text("poll.thanks", { name: "Ada" })).toBe("Thanks, Ada!");
  });

  it("lets the talk's own strings win", () => {
    const { text } = createText({
      language: "de",
      catalogs: [pollMessages],
      overrides: { de: { "poll.submit": "Abschicken" }, en: { "poll.thanks": "Danke!" } },
    });
    expect(text("poll.submit")).toBe("Abschicken");
    expect(text("poll.thanks")).toBe("Danke!");
  });

  it("reports an override of a key that no package has", () => {
    const { problems } = createText({
      language: "en",
      catalogs: [pollMessages],
      overrides: { en: { "poll.sumbit": "Send" } },
    });
    expect(problems.map((problem) => problem.key)).toEqual(["poll.sumbit"]);
  });

  it("returns the key when nothing has the message", () => {
    const { text } = createText({ language: "en", catalogs: [pollMessages] });
    expect(text("nothing.here")).toBe("nothing.here");
  });
});

describe("a presentation's strings", () => {
  it("come from core, the plugins and the talk's overrides", () => {
    const presentation = present("de", { de: { "poll.submit": "Los" } });
    expect(presentation.text("poll.submit")).toBe("Los");
    expect(presentation.text("core.view.unavailable", { view: "desk" })).toBe(
      "The desk view is not available yet.",
    );
  });

  it("refuse an override of an unknown key, with the other deck problems", () => {
    expect(() => present("en", { en: { "core.view.unavailble": "typo" } })).toThrow(
      DeckValidationError,
    );
    expect(() => present("en", { en: { "core.view.unavailble": "typo" } })).toThrow(
      /no installed package has a message with the key "core.view.unavailble"/,
    );
  });

  it("lists core's keys for the reference", () => {
    expect(messageKeys(coreMessages)).toContain("core.view.unavailable");
    expect(messageKeys(coreMessages)).toEqual([...messageKeys(coreMessages)].sort());
  });
});
