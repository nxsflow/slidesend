import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serverImportsOfBrowserEntry } from "./entry-separation";

const root = join(import.meta.dirname, "..");
const packages = readdirSync(join(root, "packages"));

describe("browser entries never import server code", () => {
  it.each(packages)("packages/%s", async (name) => {
    expect(await serverImportsOfBrowserEntry(join(root, "packages", name))).toEqual([]);
  });

  it("detects a leak through an intermediate module and a foreign server entry", async () => {
    const leaks = await serverImportsOfBrowserEntry(join(import.meta.dirname, "fixtures", "leaky"));
    expect(leaks).toEqual(["src/server.ts", "src/helper.ts -> @nxsflow/slidesend-core/server"]);
  });
});
