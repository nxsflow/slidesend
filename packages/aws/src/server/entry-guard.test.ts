import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiNamespace, AppSetting, Scope } from "@aws-blocks/blocks";
import { describe, expect, it } from "vitest";
import { createAwsBackend } from "./backend";
import { onlyApiNamespaces } from "./entry-guard";

// The Blocks mocks keep their data under `.bb-data` in the working directory.
process.chdir(mkdtempSync(join(tmpdir(), "slidesend-aws-guard-")));

const config = { meta: { title: "t", language: "en", plannedMinutes: 20 }, plannedMinutes: 20 };
const scope = () => new Scope(`sd-${Math.random().toString(36).slice(2, 8)}`);

/** An entry module the way `import("./index.js")` yields one: a frozen, prototype-less record. */
const entryModule = (exports: Record<string, unknown>) =>
  Object.freeze(Object.assign(Object.create(null), exports));

describe("onlyApiNamespaces", () => {
  it("passes an entry module that exports only API namespaces, and returns it", () => {
    const own = scope();
    const entry = entryModule({
      slidesend: createAwsBackend(own, config as never).api,
      other: new ApiNamespace(own, "other", () => ({ ping: async () => "pong" })),
    });
    expect(onlyApiNamespaces(entry)).toBe(entry);
  });

  it("refuses an exported Scope", () => {
    expect(() => onlyApiNamespaces(entryModule({ scope: scope() }))).toThrow(/"scope"/);
  });

  it("refuses an exported building block", () => {
    const control = new AppSetting(scope(), "sd-guard", { secret: true });
    expect(() => onlyApiNamespaces(entryModule({ control }))).toThrow(/"control"/);
  });

  it("refuses the whole createAwsBackend result", () => {
    const backend = createAwsBackend(scope(), config as never);
    expect(() => onlyApiNamespaces(entryModule({ backend }))).toThrow(/"backend"/);
  });

  it("refuses a plain function", () => {
    const helper = async () => "secret";
    expect(() => onlyApiNamespaces(entryModule({ helper }))).toThrow(/"helper"/);
  });

  it("refuses a plain object", () => {
    const settings = { region: "eu-central-1" };
    expect(() => onlyApiNamespaces(entryModule({ settings }))).toThrow(/"settings"/);
  });

  it("names every export that is not a namespace, and keeps quiet about the namespaces", () => {
    const own = scope();
    const backend = createAwsBackend(own, config as never);
    const entry = entryModule({ slidesend: backend.api, backend, scope: own, plannedMinutes: 20 });
    let message = "";
    try {
      onlyApiNamespaces(entry);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/"backend", "scope", "plannedMinutes"/);
    expect(message).not.toMatch(/"slidesend"/);
  });
});

describe("the real entry modules", () => {
  it("examples/gravity/aws-blocks/index.ts exports only API namespaces", async () => {
    const gravity = join(import.meta.dirname, "../../../../examples/gravity/aws-blocks/index.ts");
    const entry = await import(gravity);
    expect(onlyApiNamespaces(entry)).toBe(entry);
    expect(Object.keys(entry).sort()).toEqual(["agentChat", "slidesend"]);
  });
});
