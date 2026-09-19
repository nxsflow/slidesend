import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLiteralStyles } from "./literal-styles";

const root = join(import.meta.dirname, "..");

describe("package CSS and components use design tokens only", () => {
  it("has no literal colors or font families in packages/*/src", () => {
    expect(findLiteralStyles(join(root, "packages"))).toEqual([]);
  });

  it("finds them in a deliberately wrong fixture", () => {
    expect(findLiteralStyles(join(import.meta.dirname, "fixtures", "literal-styles"))).toEqual([
      'src/Bad.tsx:2: named color "color: "red"',
      'src/Bad.tsx:2: font family "fontFamily: ""',
      'src/bad.css:2: hex color "#1a2b3c"',
      'src/bad.css:3: color function "rgb("',
      'src/bad.css:4: named color "border: 1px solid white"',
      'src/bad.css:5: font family "font-family:"',
    ]);
  });
});
