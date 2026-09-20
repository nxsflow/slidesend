# The slidesend command

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

| Command | Usage | What it does |
|---|---|---|
| `check` | `slidesend check [--config <file>] [--render]` | Loads presentation.config.ts and validates the deck against the installed plugins; exits non-zero and names every problem by slide id and field path. With --render it also opens every step on the stage and reports what does not fit. |
| `dev` | `slidesend dev [--config <file>] [--port <number>] [--local]` | Starts the talk for development and prints its links: on the platform's dev backend if a platform is configured, otherwise (or with --local) in local mode, with stage and desk in one browser and no audience. |
| `pdf` | `slidesend pdf [--config <file>] [--out <dir>]` | Writes the talk and its storyboard as PDFs with real text, from the same views the browser shows, and fails if a document loses pages or a slide overflows its page. |
| `help` | `slidesend help` | Lists the commands, including those of the configured platform. |
| `deploy`, `bootstrap`, `open`, `destroy` | `slidesend <command>` | Provided by the configured platform package, e.g. `@slidesend/aws`. |
