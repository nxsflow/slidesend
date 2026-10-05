# The example talk

"How does gravity work?": demo, test object and the source of the code samples in the docs.
The section below is the one every talk project adds to its `AGENTS.md`
([packages/core/docs/agents-md.md](../../packages/core/docs/agents-md.md)).

## Slidesend

This is a talk built with Slidesend. The documentation of the installed version ships in
`node_modules`; read it before changing the deck, the design, a plugin or the deployment, and
prefer it over anything you remember about Slidesend.

- Start here: `node_modules/@slidesend/core/docs/building-a-talk.md` — the decisions to ask
  the speaker for, setting up the talk, structuring the content, the design, own templates
- Index of all docs: `node_modules/@slidesend/core/docs/README.md`
- Deck, nodes, steps, timing: `node_modules/@slidesend/core/docs/writing-slides.md`
- Every node of the basics: `node_modules/@slidesend/basics/docs/nodes.md`
- Own templates (blocks, slides, activities): `node_modules/@slidesend/core/docs/plugins.md`
- Design: `node_modules/@slidesend/core/docs/design.md`
- Agents: `node_modules/@slidesend/agent/docs/agents.md`
- Deploying to AWS: `node_modules/@slidesend/aws/docs/deploy-aws.md` and `continuous-deployment.md`

Rules:

- Before writing slides for a new talk, ask the speaker for the decisions in
  `building-a-talk.md`. Never invent facts, numbers or quotes for the content.
- Run `npx slidesend check` after every change to the deck; it names every problem by slide id
  and field path. `npx slidesend check --render` also finds slides that do not fit the stage.
- Use design tokens for every color, font and radius in components, never literal values.
- Never edit files under `node_modules/@slidesend/*`. If the tool cannot do something, write a
  plugin in this project.
- Never print, log or commit the control secret (the `#key=` part of the desk link).
