import { describe, expect, it } from "vitest";
import { deskLinks, slidesendDev } from "./dev-bridge";

describe("the dev bridge's desk links", () => {
  it("prints one for this machine and one for each network address", () => {
    expect(
      deskLinks(
        { local: ["http://localhost:5173/"], network: ["http://192.168.1.20:5173/"] },
        "s3cret",
      ),
    ).toEqual([
      "  Slidesend desk: http://localhost:5173/desk#key=s3cret",
      "  Slidesend desk for phones on this network: http://192.168.1.20:5173/desk#key=s3cret",
    ]);
  });

  it("follows Vite's own address lines, once Vite knows its addresses", () => {
    const lines: string[] = [];
    const vite = {
      middlewares: { use: () => {} },
      config: { logger: { info: (line: string) => lines.push(line) } },
      resolvedUrls: { local: ["http://localhost:5174/"], network: ["http://10.0.0.5:5174/"] },
      printUrls: () => lines.push("vite urls"),
    };
    slidesendDev({ defaultPlannedMinutes: 10, secret: "k" }).configureServer(vite);
    vite.printUrls();
    expect(lines).toEqual([
      "vite urls",
      "  Slidesend desk: http://localhost:5174/desk#key=k",
      "  Slidesend desk for phones on this network: http://10.0.0.5:5174/desk#key=k",
    ]);
  });
});
