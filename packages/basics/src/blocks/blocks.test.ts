import { createRegistry, NodeValidationError } from "@slidesend/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  basics,
  diff,
  image,
  list,
  qr,
  quote,
  RichText,
  reveal,
  statement,
  timeline,
} from "../index";

const registry = createRegistry([basics()]);
const parse = (node: object) => registry.parse("block", node) as Record<string, unknown>;
const problems = (node: object) => {
  try {
    registry.parse("block", node);
  } catch (error) {
    if (error instanceof NodeValidationError)
      return error.issues.map((issue) => issue.path.join("."));
    throw error;
  }
  throw new Error("expected a NodeValidationError");
};

describe("schemas", () => {
  it("fill in the defaults", () => {
    expect(parse(statement({ text: "Gravity pulls." }))).toEqual({
      type: "statement",
      text: "Gravity pulls.",
      size: "large",
    });
    expect(parse(list({ items: ["a"] }))).toMatchObject({ ordered: false, columnsFrom: 7 });
    expect(parse(reveal({ items: [{ text: "a" }] }))).toMatchObject({ ordered: false });
    expect(parse(qr({}))).toEqual({ type: "qr", caption: "Join on your phone", size: 420 });
    expect(parse(image({ src: "/moon.png", alt: "The Moon" }))).toMatchObject({ fit: "contain" });
  });

  it("reject what a block cannot show", () => {
    expect(problems(statement({ text: "" }))).toEqual(["text"]);
    expect(problems(list({ items: [] }))).toEqual(["items"]);
    expect(problems(timeline({ entries: [{ label: "only one" }] }))).toEqual(["entries"]);
    expect(problems(image({ src: "/moon.png", alt: "" }))).toEqual(["alt"]);
    expect(problems(quote({ text: "" }))).toEqual(["text"]);
    expect(problems(reveal({ items: [] }))).toEqual(["items"]);
    expect(
      problems(diff({ before: { label: "a", text: "" }, after: { label: "b", text: "c" } })),
    ).toEqual(["before.text"]);
  });
});

describe("steps", () => {
  it("are one per block, except reveal, which counts its items", () => {
    expect(registry.stepsOf(statement({ text: "One" }))).toBe(1);
    expect(registry.stepsOf(qr({}))).toBe(1);
    const node = reveal({ items: [{ text: "a", notes: "First" }, { text: "b" }, { text: "c" }] });
    expect(registry.stepsOf(node)).toBe(3);
    expect(registry.describe(node)).toEqual({
      label: "a",
      steps: [{ notes: "First" }, {}, {}],
    });
  });
});

describe("rich text", () => {
  it("renders the documented subset and nothing else", () => {
    expect(renderToStaticMarkup(RichText({ text: "**bold** and *soft*" }) as never)).toBe(
      "<strong>bold</strong> and <em>soft</em>",
    );
    expect(renderToStaticMarkup(RichText({ text: "first\nsecond" }) as never)).toBe(
      "first<br/>second",
    );
  });

  it("shows an injection attempt as text instead of running it", () => {
    const attack = '<script>alert("x")</script><img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(RichText({ text: attack }) as never);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("onerror=alert(1)&gt;");
  });

  it("leaves a lone asterisk alone", () => {
    expect(renderToStaticMarkup(RichText({ text: "2 * 3 = 6" }) as never)).toBe("2 * 3 = 6");
  });
});
