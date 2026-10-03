import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const license = readFileSync(join(root, "LICENSE"), "utf8");
const packages = readdirSync(join(root, "packages"));

// npm only packs a LICENSE that sits in the package folder, so each package carries a copy.
describe("every package ships the repository license", () => {
  it.each(packages)("packages/%s", (name) => {
    const dir = join(root, "packages", name);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(manifest.license).toBe("Apache-2.0");
    expect(readFileSync(join(dir, "LICENSE"), "utf8")).toBe(license);
  });
});

// The notice reads "2026" in the first year and "2026-<current year>" afterwards. The year is
// taken in UTC, like the schedule of .github/workflows/copyright-year.yml, which opens the pull
// request that updates LICENSE, the package copies and README when a new year begins.
describe("the copyright notice is current", () => {
  const firstYear = 2026;
  const currentYear = new Date().getUTCFullYear();
  const years = currentYear === firstYear ? `${firstYear}` : `${firstYear}-${currentYear}`;
  const notice = `Copyright ${years} Carsten Koch`;

  it("LICENSE", () => {
    expect(license.match(/Copyright \d{4}(?:-\d{4})? Carsten Koch/)?.[0]).toBe(notice);
  });

  it("README.md", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    expect(readme.match(/Copyright \d{4}(?:-\d{4})? Carsten Koch/)?.[0]).toBe(notice);
  });
});
