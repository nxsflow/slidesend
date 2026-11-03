import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { palette } from "./palette";

/** WCAG relative luminance and contrast ratio of two "#rrggbb" colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (bl as number);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("the desk palette", () => {
  it("is the slidesend dark theme: ink page, its surface and border, paper text", () => {
    expect(palette.page).toBe("#17151F");
    expect(palette.panel).toBe("#211E2B");
    expect(palette.line).toBe("#36323F");
    expect(palette.text).toBe("#F7F5F2");
    expect(palette.muted).toBe("#A1A1AA");
  });

  it("lights the primary action in spotlight, with ink on it", () => {
    expect(palette.primary).toBe("#F04E23");
    expect(palette.onPrimary).toBe("#17151F");
  });

  it("keeps every text colour readable on the page and on a panel", () => {
    for (const ground of [palette.page, palette.panel]) {
      for (const ink of [
        palette.text,
        palette.soft,
        palette.muted,
        palette.good,
        palette.bad,
        palette.cue,
      ]) {
        expect(contrast(ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("is the only place in the desk that names a colour", () => {
    for (const file of ["DeskView.tsx", "Present.tsx", "Review.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? [], file).toEqual([]);
    }
  });
});
