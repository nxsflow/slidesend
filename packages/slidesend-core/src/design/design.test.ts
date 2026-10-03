import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  chapterAccent,
  cssVariable,
  type Design,
  defineDeck,
  defineDesign,
  definePlugin,
  definePresentation,
  defineSlide,
  fontFaceCss,
  stageFrameProps,
  stepMeta,
  surfaceVariables,
  tokenReference,
} from "../index";
import { plainDesign } from "../testing";

const design: Design = {
  ...plainDesign,
  name: "test",
  tokens: {
    ...plainDesign.tokens,
    stage: { color: { background: "black", text: "white" } },
    phone: { color: { primary: "purple" } },
  },
};

describe("surfaces", () => {
  it("let a surface's colors win over the base, and keep fonts and radii", () => {
    const stage = surfaceVariables(design, "stage");
    const phone = surfaceVariables(design, "phone");
    expect(stage[cssVariable("color", "background")]).toBe("black");
    expect(stage[cssVariable("color", "primary")]).toBe("blue");
    expect(phone[cssVariable("color", "background")]).toBe("white");
    expect(phone[cssVariable("color", "primary")]).toBe("purple");
    expect(phone[cssVariable("color", "textMuted")]).toBe("gray");
    expect(stage["--slidesend-color-text-muted"]).toBe("gray");
    expect(stage[cssVariable("font", "display")]).toBe("serif");
    expect(phone[cssVariable("radius", "large")]).toBe("12px");
  });

  it("give the desk the chapter accents only", () => {
    expect(surfaceVariables(design, "desk", 1)).toEqual({
      "--slidesend-accent-1": "teal",
      "--slidesend-accent-2": "purple",
      "--slidesend-accent-3": "olive",
      "--slidesend-accent": "purple",
    });
  });
});

describe("accents", () => {
  it("follow the chapter position and repeat when chapters outnumber them", () => {
    expect([0, 1, 2, 3, 4, 7].map((index) => chapterAccent(design, index))).toEqual([
      "teal",
      "purple",
      "olive",
      "teal",
      "purple",
      "purple",
    ]);
    expect(surfaceVariables(design, "stage", 5)["--slidesend-accent"]).toBe("olive");
  });
});

describe("defineDesign", () => {
  it("names every missing token and component", () => {
    const { focus: _focus, ...color } = plainDesign.tokens.base.color;
    const { mono: _mono, ...font } = plainDesign.tokens.base.font;
    const incomplete = {
      ...plainDesign,
      name: "broken",
      tokens: { base: { ...plainDesign.tokens.base, color, font, accents: [] } },
      IdlePage: null,
    } as unknown as Design;
    expect(() => defineDesign(incomplete)).toThrow(
      [
        'The design "broken" is incomplete:',
        "  missing tokens.base.color.focus",
        "  missing tokens.base.font.mono",
        "  tokens.base.accents: Too small: expected array to have >=1 items",
        "  missing IdlePage",
      ].join("\n"),
    );
  });

  it("rejects an override of a token that does not exist", () => {
    const wrong = {
      ...plainDesign,
      tokens: { ...plainDesign.tokens, phone: { color: { brand: "pink" } } },
    } as unknown as Design;
    expect(() => defineDesign(wrong)).toThrow('tokens.phone.color: Unrecognized key: "brand"');
  });

  it("checks the font files", () => {
    const fonts = [{ family: "Display", src: "", weight: 700 }];
    expect(() => defineDesign({ ...plainDesign, fonts })).toThrow("fonts[0].src");
  });
});

describe("fonts", () => {
  it("become @font-face rules with the format from the file name and swap display", () => {
    expect(
      fontFaceCss([
        { family: "Brand Display", src: "/brand/display.woff2", weight: "100 900" },
        { family: 'Say "Hi"', src: "/brand/text.ttf?v=2", weight: 400, style: "italic" },
      ]),
    ).toBe(
      [
        "@font-face {",
        '  font-family: "Brand Display";',
        '  src: url("/brand/display.woff2") format("woff2");',
        "  font-weight: 100 900;",
        "  font-style: normal;",
        "  font-display: swap;",
        "}",
        "@font-face {",
        '  font-family: "Say \\"Hi\\"";',
        '  src: url("/brand/text.ttf?v=2") format("truetype");',
        "  font-weight: 400;",
        "  font-style: italic;",
        "  font-display: swap;",
        "}",
      ].join("\n"),
    );
    expect(fontFaceCss()).toBe("");
  });
});

describe("stage frame", () => {
  it("receives progress and the frame hints of the current step", () => {
    const hero = defineSlide({
      type: "hero",
      schema: z.object({ title: z.string(), ...stepMeta }),
      steps: () => 2,
      describe: (data) => ({ label: data.title, steps: [{ frame: { bigLogo: true } }, {}] }),
      Component: () => null,
    });
    const presentation = definePresentation({
      deck: defineDeck({
        meta: { title: "Gravity", language: "en" },
        chapters: [
          { id: "intro", title: "Introduction" },
          { id: "falling", title: "Falling" },
        ],
        slides: [
          hero({ chapter: "intro", title: "Hi" }),
          hero({ chapter: "falling", title: "Drop" }),
        ],
      }),
      design,
      plugins: [definePlugin({ name: "hero", slides: [hero] })],
    });
    expect(stageFrameProps(presentation, 0)).toEqual({
      progress: { index: 0, total: 4, chapterIndex: 0, chapterTitle: "Introduction" },
      frame: { bigLogo: true },
    });
    expect(stageFrameProps(presentation, 3)).toEqual({
      progress: { index: 3, total: 4, chapterIndex: 1, chapterTitle: "Falling" },
      frame: {},
    });
    expect(() => stageFrameProps(presentation, 4)).toThrow("no step 4");
  });
});

describe("token reference", () => {
  it("lists every token once", () => {
    const tokens = tokenReference().map((row) => row.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens).toContain("color.onPrimary");
    expect(tokenReference().find((row) => row.token === "color.onPrimary")?.variable).toBe(
      "--slidesend-color-on-primary",
    );
  });
});
