import type { Presentation } from "../deck/presentation";

/** One command of `slidesend`, as the help and the command reference show it. */
export interface CommandDefinition {
  name: string;
  usage: string;
  description: string;
}

/** The commands core itself provides; a platform adds its own (spec §8, §14). */
export const coreCommands: readonly CommandDefinition[] = [
  {
    name: "check",
    usage: "slidesend check [--config <file>]",
    description:
      "Loads presentation.config.ts and validates the deck against the installed plugins; exits non-zero and names every problem by slide id and field path.",
  },
  {
    name: "dev",
    usage: "slidesend dev [--config <file>] [--port <number>]",
    description:
      "Starts the talk for development and prints the stage, desk and phone links. Without a platform the talk runs in local mode: stage and desk in one browser, no audience.",
  },
  {
    name: "help",
    usage: "slidesend help",
    description: "Lists the commands, including those of the configured platform.",
  },
];

/** The commands a platform package usually contributes, for the help without a platform. */
export const platformCommandNames = ["deploy", "bootstrap", "open", "destroy"] as const;

/** The command reference as a Markdown table, for the docs. */
export function commandReferenceTable(): string {
  return [
    "| Command | Usage | What it does |",
    "|---|---|---|",
    ...coreCommands.map(
      (command) => `| \`${command.name}\` | \`${command.usage}\` | ${command.description} |`,
    ),
    `| ${platformCommandNames.map((name) => `\`${name}\``).join(", ")} | \`slidesend <command>\` | Provided by the configured platform package, e.g. \`@slidesend/aws\`. |`,
    "",
  ].join("\n");
}

/** Everything a command needs from the outside world, so that it can be tested without it. */
export interface CommandIo {
  /** The project folder, where `presentation.config.ts` lives. */
  projectRoot: string;
  log(line: string): void;
  error(line: string): void;
  /** Loads the presentation from the config file; throws what defining it throws. */
  loadPresentation(configFile: string): Promise<Presentation>;
  /** Starts the Vite dev server and resolves with its local URL. */
  startDevServer(port?: number): Promise<string>;
}

/** The parsed command line. */
export interface CommandLine {
  command: string;
  args: string[];
  config: string;
  port?: number;
}

/** Reads `slidesend <command> [--config <file>] [--port <n>] [args]`. */
export function parseCommandLine(argv: readonly string[]): CommandLine {
  const args: string[] = [];
  let config = "presentation.config.ts";
  let port: number | undefined;
  const rest = [...argv];
  const command = rest.shift() ?? "help";
  while (rest.length > 0) {
    const arg = rest.shift() as string;
    if (arg === "--config") config = rest.shift() ?? config;
    else if (arg === "--port") port = Number(rest.shift());
    else args.push(arg);
  }
  return {
    command: command === "--help" || command === "-h" ? "help" : command,
    args,
    config,
    port,
  };
}

function help(io: CommandIo, presentation?: Presentation) {
  io.log("Usage: slidesend <command>");
  io.log("");
  for (const command of coreCommands) io.log(`  ${command.name.padEnd(10)} ${command.description}`);
  const platform = presentation?.platform;
  if (platform?.commands) {
    io.log("");
    io.log(`Commands of the platform "${platform.name}":`);
    for (const [name, command] of Object.entries(platform.commands)) {
      io.log(`  ${name.padEnd(10)} ${command.description}`);
    }
  }
}

async function load(io: CommandIo, line: CommandLine): Promise<Presentation | undefined> {
  try {
    return await io.loadPresentation(line.config);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (failure.name === "DeckValidationError") io.error(failure.message);
    else io.error(`Could not load ${line.config}: ${failure.message}`);
    return undefined;
  }
}

/**
 * Runs one `slidesend` command and returns the exit code. Platform commands are delegated to the
 * configured platform; without one, they explain that there is nothing to run them on.
 */
export async function runCommand(io: CommandIo, line: CommandLine): Promise<number> {
  if (line.command === "help") {
    // Show the platform's commands too, if the config loads; the help must work without it.
    help(io, await io.loadPresentation(line.config).catch(() => undefined));
    return 0;
  }

  const presentation = await load(io, line);
  if (!presentation) return 1;

  if (line.command === "check") {
    const minutes = Math.round(presentation.plannedMinutes * 10) / 10;
    io.log(
      `The deck is valid: ${presentation.slides.length} slides, ${presentation.steps.length} steps, ${minutes} planned minutes.`,
    );
    return 0;
  }

  if (line.command === "dev") {
    const url = (await io.startDevServer(line.port)).replace(/\/$/, "");
    if (presentation.platform) {
      io.log(
        `The platform "${presentation.platform.name}" is configured; its dev backend is not started by this command yet.`,
      );
    }
    io.log(`  Stage  ${url}/stage/local`);
    io.log(`  Desk   ${url}/desk`);
    io.log(`  Phones ${url}/  (local mode: no audience can join)`);
    return 0;
  }

  const command = presentation.platform?.commands?.[line.command];
  const platformCommand = (platformCommandNames as readonly string[]).includes(line.command);
  if (!command && !platformCommand) {
    io.error(`Unknown command "${line.command}". Run "slidesend help" for the list.`);
    return 1;
  }
  if (command) {
    await command.run({ projectRoot: io.projectRoot, args: line.args, log: io.log });
    return 0;
  }
  if (!presentation.platform) {
    io.error(
      `"slidesend ${line.command}" needs a platform, and none is configured in ${line.config}. Add one, e.g. platform: aws({ ... }), or run "slidesend help".`,
    );
  } else {
    io.error(
      `The platform "${presentation.platform.name}" has no command "${line.command}". Run "slidesend help" for the list.`,
    );
  }
  return 1;
}
