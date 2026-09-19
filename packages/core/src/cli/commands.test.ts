import { describe, expect, it } from "vitest";
import { type CommandIo, commandReferenceTable, parseCommandLine, runCommand } from "./commands";

function io(overrides: Partial<CommandIo> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const fake: CommandIo = {
    projectRoot: "/talk",
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    loadPresentation: async () =>
      ({ slides: [{}, {}], steps: [{}, {}, {}], plannedMinutes: 4.25 }) as never,
    startDevServer: async (port) => `http://localhost:${port ?? 5173}/`,
    ...overrides,
  };
  return { fake, out, err };
}

describe("command line", () => {
  it("reads the command, config, port and the rest", () => {
    expect(parseCommandLine(["check"])).toEqual({
      command: "check",
      args: [],
      config: "presentation.config.ts",
      port: undefined,
      local: false,
    });
    expect(parseCommandLine(["dev", "--port", "5300", "--config", "talk.config.ts", "x"])).toEqual({
      command: "dev",
      args: ["x"],
      config: "talk.config.ts",
      port: 5300,
      local: false,
    });
    expect(parseCommandLine(["dev", "--local"]).local).toBe(true);
    expect(parseCommandLine([]).command).toBe("help");
    expect(parseCommandLine(["--help"]).command).toBe("help");
  });
});

describe("commands", () => {
  it("check reports a valid deck and exits 0", async () => {
    const { fake, out } = io();
    expect(await runCommand(fake, parseCommandLine(["check"]))).toBe(0);
    expect(out).toEqual(["The deck is valid: 2 slides, 3 steps, 4.3 planned minutes."]);
  });

  it("check prints the validation problems and exits 1", async () => {
    const failure = Object.assign(new Error("The deck has 1 problem(s):\n  slides[0] ..."), {
      name: "DeckValidationError",
    });
    const { fake, err } = io({ loadPresentation: async () => Promise.reject(failure) });
    expect(await runCommand(fake, parseCommandLine(["check"]))).toBe(1);
    expect(err).toEqual([failure.message]);
  });

  it("names the config file when it cannot be loaded", async () => {
    const { fake, err } = io({
      loadPresentation: async () => Promise.reject(new Error("no file")),
    });
    expect(await runCommand(fake, parseCommandLine(["check"]))).toBe(1);
    expect(err).toEqual(["Could not load presentation.config.ts: no file"]);
  });

  it("dev prints the stage, desk and phone links of local mode", async () => {
    const { fake, out } = io();
    expect(await runCommand(fake, parseCommandLine(["dev", "--port", "5300"]))).toBe(0);
    expect(out).toEqual([
      "  Stage  http://localhost:5300/stage/local",
      "  Desk   http://localhost:5300/desk",
      "  Phones http://localhost:5300/  (local mode: no audience can join)",
    ]);
  });

  it("dev runs the platform's dev backend, unless --local asks for local mode", async () => {
    const runs: unknown[] = [];
    const platform = {
      name: "test",
      commands: {
        dev: { description: "Dev.", run: async (context: unknown) => void runs.push(context) },
      },
    };
    const { fake, out } = io({
      loadPresentation: async () =>
        ({ slides: [], steps: [], plannedMinutes: 0, platform }) as never,
    });
    expect(await runCommand(fake, parseCommandLine(["dev", "--port", "4000"]))).toBe(0);
    expect(runs).toMatchObject([{ args: ["--port", "4000"] }]);
    expect(await runCommand(fake, parseCommandLine(["dev", "--local"]))).toBe(0);
    expect(runs).toHaveLength(1);
    expect(out.at(-1)).toContain("local mode");
  });

  it("explains that a platform command needs a platform", async () => {
    const { fake, err } = io();
    expect(await runCommand(fake, parseCommandLine(["deploy"]))).toBe(1);
    expect(err[0]).toMatch(/"slidesend deploy" needs a platform, and none is configured/);
  });

  it("delegates a platform command to the configured platform", async () => {
    const calls: unknown[] = [];
    const platform = {
      name: "test",
      commands: {
        deploy: {
          description: "Deploys.",
          run: async (context: unknown) => {
            calls.push(context);
          },
        },
      },
    };
    const { fake, out, err } = io({
      loadPresentation: async () =>
        ({ slides: [], steps: [], plannedMinutes: 0, platform }) as never,
    });
    expect(await runCommand(fake, parseCommandLine(["deploy", "--prod"]))).toBe(0);
    expect(calls).toMatchObject([{ projectRoot: "/talk", args: ["--prod"] }]);
    expect(await runCommand(fake, parseCommandLine(["destroy"]))).toBe(1);
    expect(err.at(-1)).toBe(
      'The platform "test" has no command "destroy". Run "slidesend help" for the list.',
    );
    await runCommand(fake, parseCommandLine(["help"]));
    expect(out).toContain('Commands of the platform "test":');
  });

  it("rejects an unknown command", async () => {
    const { fake, err } = io();
    expect(await runCommand(fake, parseCommandLine(["chek"]))).toBe(1);
    expect(err).toEqual(['Unknown command "chek". Run "slidesend help" for the list.']);
  });

  it("builds the command reference from the definitions", () => {
    const table = commandReferenceTable();
    expect(table).toContain("| `check` | `slidesend check [--config <file>]` |");
    expect(table).toContain("`deploy`, `bootstrap`, `open`, `destroy`");
  });
});
