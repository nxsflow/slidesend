import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findHardcodedText } from "./hardcoded-text";

const root = join(import.meta.dirname, "..");

// Everything a person reads in core comes from the message catalog (spec §6.5).
describe("core shows no hardcoded text", () => {
  it("has none in its components", () => {
    expect(findHardcodedText(join(root, "packages", "slidesend-core", "src"))).toEqual([]);
  });

  it("finds text and image descriptions in a deliberately wrong fixture", () => {
    expect(findHardcodedText(join(import.meta.dirname, "fixtures", "hardcoded-text"))).toEqual([
      "src/Bad.tsx:3: Please answer on your phone.",
      "src/Bad.tsx:4: A chart of the answers",
    ]);
  });
});
