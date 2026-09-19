# The slidesend command

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

| Command | Usage | What it does |
|---|---|---|
| `check` | `slidesend check [--config <file>]` | Loads presentation.config.ts and validates the deck against the installed plugins; exits non-zero and names every problem by slide id and field path. |
| `dev` | `slidesend dev [--config <file>] [--port <number>]` | Starts the talk for development and prints the stage, desk and phone links. Without a platform the talk runs in local mode: stage and desk in one browser, no audience. |
| `help` | `slidesend help` | Lists the commands, including those of the configured platform. |
| `deploy`, `bootstrap`, `open`, `destroy` | `slidesend <command>` | Provided by the configured platform package, e.g. `@slidesend/aws`. |
