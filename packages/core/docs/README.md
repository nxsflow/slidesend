# slidesend documentation

slidesend is a presentation tool for talks in which the audience takes part on their phones. A
deck is TypeScript; the design, the hosting platform and every slide type come from plugins.
These docs ship inside the packages, so a coding agent in a talk project finds them under
`node_modules/@slidesend/*/docs`. An agent building a talk starts with
[building-a-talk](building-a-talk.md).

| Document | Question it answers |
|---|---|
| [getting-started](getting-started.md) | From an empty folder to a running talk, locally. |
| [building-a-talk](building-a-talk.md) | For the agent: the decisions to ask for, setting up, structuring the content, design, own templates. |
| [writing-slides](writing-slides.md) | Deck, chapters, nodes, steps, timing; the nodes of `@slidesend/basics`. |
| [nodes of the basics](../../basics/docs/nodes.md) | Every field of every node of `@slidesend/basics`, with types and defaults. |
| [plugins](plugins.md) | Your own template, block and activity; coupled plugins. |
| [design](design.md) | Tokens, surfaces, frames, the three phone pages. |
| [agents](../../agent/docs/agents.md) | Defining an agent, the chat, the cost guard. |
| [sessions-and-desk](sessions-and-desk.md) | Rehearsals, live sessions, the desk, review. |
| [deploy-aws](../../aws/docs/deploy-aws.md) | Prerequisites, AWS account, local access, first deploy. |
| [continuous-deployment](../../aws/docs/continuous-deployment.md) | Bootstrap, OIDC, the workflow, troubleshooting with CloudTrail. |
| [hosting-adapters](hosting-adapters.md) | The contract for another platform. |

Generated references, always in step with the code:

- [commands](commands.md): the `slidesend` command.
- [tokens](tokens.md): every design token and its CSS variable.
- [messages](messages.md): every UI string a talk can override.

For a talk project's `AGENTS.md`: [agents-md](agents-md.md).
