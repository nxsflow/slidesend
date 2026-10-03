/** What a platform command receives when `slidesend <command>` runs it. */
export interface PlatformCommandContext {
  /** The talk project's root folder. */
  projectRoot: string;
  /** The arguments after the command name. */
  args: readonly string[];
  /** Prints one line for the person at the terminal. */
  log(line: string): void;
}

/** A command a platform adds to `slidesend`, such as `deploy`, `bootstrap`, `open`, `destroy`. */
export interface PlatformCommand {
  /** One line for `slidesend --help`. */
  description: string;
  run(context: PlatformCommandContext): Promise<void>;
}

/**
 * A hosting platform as a presentation installs it (spec §8): at most one per presentation.
 * Without one, the talk runs in local mode. Besides its name, a platform package contributes
 * commands, its docs and its CI templates.
 */
export interface Platform {
  /** The platform's name; activities key their server halves by it, e.g. `"aws"`. */
  readonly name: string;
  /** Commands the platform adds to `slidesend`, by command name. */
  readonly commands?: Readonly<Record<string, PlatformCommand>>;
  /** The absolute path of the folder with the platform's docs, shipped in the package. */
  readonly docs?: string;
  /** CI templates the platform ships, by name, as absolute file paths. */
  readonly ciTemplates?: Readonly<Record<string, string>>;
}
