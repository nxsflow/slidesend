# The section for a talk project's AGENTS.md

Copy the block below into the `AGENTS.md` (or `CLAUDE.md`) of a talk project, so a coding agent
working on the talk reads the docs of the installed version instead of guessing. Leave out the
lines of packages the talk does not install.

```markdown
## Slidesend

This is a talk built with Slidesend. The documentation of the installed version ships in
`node_modules`; read it before changing the deck, the design, a plugin or the deployment, and
prefer it over anything you remember about Slidesend.

- Start here: `node_modules/@slidesend/core/docs/README.md`
- Deck, nodes, steps, timing: `node_modules/@slidesend/core/docs/writing-slides.md`
- Own nodes: `node_modules/@slidesend/core/docs/plugins.md`
- Design: `node_modules/@slidesend/core/docs/design.md`
- Agents: `node_modules/@slidesend/agent/docs/agents.md`
- Deploying to AWS: `node_modules/@slidesend/aws/docs/deploy-aws.md` and `continuous-deployment.md`

Rules:

- Run `npx slidesend check` after every change to the deck; it names every problem by slide id
  and field path. `npx slidesend check --render` also finds slides that do not fit the stage.
- Use design tokens for every color, font and radius in components, never literal values.
- Never edit files under `node_modules/@slidesend`. If the tool cannot do something, write a
  plugin in this project.
- Never print, log or commit the control secret (the `#key=` part of the desk link).
```
