import { type OverflowFinding, overflowMessage } from "../checks/overflow";
import type { Presentation } from "../deck/presentation";
import type { Platform } from "../platform/package";
import { type PdfJob, pageCountProblem, pdfJobs } from "../print/pdf";
import { printProblemMessage, printProblems } from "../print/rules";

/** One step of the deck, as the render pass addresses it. */
export interface StepAddress {
  slideId: string;
  step: number;
}

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
    usage: "slidesend check [--config <file>] [--render]",
    description:
      "Loads presentation.config.ts and validates the deck against the installed plugins; exits non-zero and names every problem by slide id and field path. With --render it also opens every step on the stage and reports what does not fit.",
  },
  {
    name: "dev",
    usage: "slidesend dev [--config <file>] [--port <number>] [--local]",
    description:
      "Starts the talk for development and prints its links: on the platform's dev backend if a platform is configured, otherwise (or with --local) in local mode, with stage and desk in one browser and no audience.",
  },
  {
    name: "pdf",
    usage: "slidesend pdf [--config <file>] [--out <dir>]",
    description:
      "Writes the talk and its storyboard as PDFs with real text, from the same views the browser shows, and fails if a document loses pages or a slide overflows its page.",
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
    `| ${platformCommandNames.map((name) => `\`${name}\``).join(", ")} | \`slidesend <command>\` | Provided by the configured platform package, e.g. \`@nxsflow/slidesend-aws\`. |`,
    "",
  ].join("\n");
}

/** The commands a platform adds to `slidesend`, as a Markdown table for the platform's docs. */
export function platformCommandTable(platform: Platform): string {
  return [
    "| Command | What it does |",
    "|---|---|",
    ...Object.entries(platform.commands ?? {}).map(
      ([name, command]) => `| \`slidesend ${name}\` | ${command.description} |`,
    ),
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
  /**
   * Prints the given views to PDF with the talk project's browser, and reports what it found.
   * Only `pdf` needs it; a host without one says so instead of failing halfway.
   */
  writePdfs?(baseUrl: string, jobs: readonly PdfJob[]): Promise<PdfResult[]>;
  /** Stops what `startDevServer` started; `pdf` is done when its files are written. */
  stopDevServer?(): Promise<void>;
  /**
   * Opens every step on the stage and measures whether its content fits (spec §5.2). Only
   * `check --render` needs it; a host without one says so instead of passing silently.
   */
  renderCheck?(baseUrl: string, steps: readonly StepAddress[]): Promise<OverflowFinding[]>;
}

/** What writing one document produced. */
export interface PdfResult {
  job: PdfJob;
  /** How many pages the written file has. */
  pages: number;
  /** Pages whose content did not fit the sheet, 1-based. */
  overflowing: number[];
}

/** The parsed command line. */
export interface CommandLine {
  command: string;
  args: string[];
  config: string;
  port?: number;
  /** Run `dev` in local mode even when a platform is configured. */
  local: boolean;
}

/** Reads `slidesend <command> [--config <file>] [--port <n>] [--local] [args]`. */
export function parseCommandLine(argv: readonly string[]): CommandLine {
  const args: string[] = [];
  let config = "presentation.config.ts";
  let port: number | undefined;
  let local = false;
  const rest = [...argv];
  const command = rest.shift() ?? "help";
  while (rest.length > 0) {
    const arg = rest.shift() as string;
    if (arg === "--config") config = rest.shift() ?? config;
    else if (arg === "--port") port = Number(rest.shift());
    else if (arg === "--local") local = true;
    else args.push(arg);
  }
  return {
    command: command === "--help" || command === "-h" ? "help" : command,
    args,
    config,
    port,
    local,
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
    // The render pass is opt-in: it needs a browser, and `check` must stay a second-long
    // command that anyone can run in a pre-commit hook.
    if (line.args.includes("--render")) {
      if (!io.renderCheck) {
        io.error("This host cannot render; run `slidesend check --render` from the talk project.");
        return 1;
      }
      const url = (await io.startDevServer(line.port)).replace(/\/$/, "");
      try {
        const steps = presentation.steps.map((step) => ({
          slideId: step.slideId,
          step: step.step,
        }));
        let findings: OverflowFinding[];
        try {
          findings = await io.renderCheck(url, steps);
        } catch (error) {
          io.error(
            `The render pass could not run: ${error instanceof Error ? error.message : String(error)}`,
          );
          return 1;
        }
        if (findings.length > 0) {
          io.error(`${findings.length} step(s) do not fit the stage:`);
          for (const finding of findings) io.error(`  ${overflowMessage(finding)}`);
          return 1;
        }
        io.log(`Every step fits the stage: ${steps.length} checked.`);
      } finally {
        await io.stopDevServer?.();
      }
    }
    const minutes = Math.round(presentation.plannedMinutes * 10) / 10;
    // A deck can be valid and still print a lie. The honesty check is part of `check` rather
    // than a command of its own, because nobody runs the check they do not know about.
    const problems = printProblems(presentation);
    if (problems.length > 0) {
      io.error(`${problems.length} step(s) would print as they never were:`);
      for (const problem of problems) io.error(`  ${printProblemMessage(problem)}`);
      return 1;
    }
    io.log(
      `The deck is valid: ${presentation.slides.length} slides, ${presentation.steps.length} steps, ${minutes} planned minutes.`,
    );
    return 0;
  }

  if (line.command === "pdf") {
    if (!io.writePdfs) {
      io.error("This host cannot print; run `slidesend pdf` from the talk project.");
      return 1;
    }
    const out = line.args[line.args.indexOf("--out") + 1];
    const jobs = pdfJobs(presentation, line.args.includes("--out") && out ? out : undefined);
    const url = (await io.startDevServer(line.port)).replace(/\/$/, "");
    try {
      const results = await io.writePdfs(url, jobs);
      let failed = false;
      for (const result of results) {
        const problem = pageCountProblem(result.job, result.pages);
        if (problem) {
          io.error(problem);
          failed = true;
        }
        if (result.overflowing.length > 0) {
          // A slide that overflows its sheet is cut off on paper, silently. Say which.
          io.error(
            `${result.job.file}: page(s) ${result.overflowing.join(", ")} do not fit the sheet.`,
          );
          failed = true;
        }
        if (!problem) io.log(`  ${result.job.file}  ${result.pages} page(s)`);
      }
      return failed ? 1 : 0;
    } finally {
      await io.stopDevServer?.();
    }
  }

  if (line.command === "dev") {
    const platformDev = presentation.platform?.commands?.dev;
    if (platformDev && !line.local) {
      const args = [...line.args, ...(line.port ? ["--port", String(line.port)] : [])];
      await platformDev.run({ projectRoot: io.projectRoot, args, log: io.log });
      return 0;
    }
    const url = (await io.startDevServer(line.port)).replace(/\/$/, "");
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
    try {
      await command.run({ projectRoot: io.projectRoot, args: line.args, log: io.log });
    } catch (error) {
      // A platform command that fails has already said why, in its own words; the person at the
      // terminal gets that sentence and an exit code, not a stack trace from inside a package.
      io.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
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
