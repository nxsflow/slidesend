# Agents

`@nxsflow/slidesend-agent` lets the audience talk to an AI agent on their phones during the talk: a chat
with history, resume after the phone was locked, and a collapsible view of the agent's working
steps. Locally the agent answers from a canned provider, so the whole flow can be built and
tested without a cloud account; deployed on AWS it runs on Amazon Bedrock.

## Define the agents

The talk's agents live in one file that both halves import: the backend builds one Agent block
per agent from it, and the deck refers to the agents by name.

<!-- snippet: examples/gravity/src/agents.ts#define-agents -->
```ts
export const agents = defineAgents({
  newton: {
    label: "Newton",
    systemPrompt: [
      "You are Isaac Newton, answering a school class during a talk about gravity.",
      "Answer in at most three sentences, in plain words, and never with a formula.",
      "If a question is not about falling, gravity or the Moon, say so and ask for one that is.",
    ].join("\n"),
    model: "fast",
    // This talk is partly about what an agent is told, so the class may read the prompt.
    showPrompt: true,
  },
});
```
<!-- end snippet -->

| Field | Meaning |
|---|---|
| `systemPrompt` | What the agent is told before the first message. Required. The tool never adds to it. |
| `model` | `"fast"` (default) or `"smart"`; the platform maps the tier to a model, see [Models and cost](#models-and-cost). |
| `label` | The name on the phone and in the desk; defaults to the key. |
| `showPrompt` | Lets the phone show the system prompt to the audience. Off by default: a prompt can carry names, instructions and a tone nobody meant to publish. |

An agent's name is lowercase letters, digits and dashes: it becomes part of a block id.

## Install the plugin and use it in the deck

```ts fragment
// presentation.config.ts
plugins: [basics(), agent({ agents })],
```

and attach the chat to a step like any activity:

```ts fragment
activity: agentChat({
  id: "ask-newton",
  agent: "newton",
  message: "Newton is listening. Ask him one thing about falling.",
  singleTurn: true,
  suggestions: ["Why does the Moon not fall down?", "Do I pull the Earth too?"],
}),
```

`agent` is a reference: a deck that names an agent nobody defined fails to load, with the name
in the message. `singleTurn` ends the conversation after the first answer; `suggestions` are
offered as buttons, so nobody has to think of a question first.

## The backend

The chat has its own API namespace next to core's. In the project's `aws-blocks/index.ts`:

<!-- snippet: examples/gravity/aws-blocks/index.ts#aws-backend -->
```ts
const scope = new Scope("gravity");
const backend = createAwsBackend(scope, config);
export const slidesend = backend.api;

// The agent chat's own namespace: one Agent block per defined agent, wired by explicit
// composition rather than discovered (spec §4.1, D4).
export const agentChat = createAgentChat(scope, {
  agents,
  platform: backend.platform,
  guards: backend.server.sessions.guards,
  tools: { newton: newtonTools },
}).api;
```
<!-- end snippet -->

The talk project also needs `@aws-blocks/bb-file-bucket` as a dependency (the Agent block brings
a bucket of its own, and the generated client imports its middleware), and the browser must hand
**every** exported namespace to the client: `awsClient(blocks)`, where `blocks` is the whole
`aws-blocks` module, not only `slidesend`.

## Tools

A tool lets the agent act while it answers: look something up, compute, call an API. The model
decides when to call one from its description. Tools are given in the backend, per agent, and
not in `defineAgents`: a tool's handler is server code (a database, a mail client, a secret),
and `defineAgents` is loaded by the phones too. The example gives Newton one tool, in
`aws-blocks/tools.ts`:

<!-- snippet: examples/gravity/aws-blocks/tools.ts#agent-tools -->
```ts
export const newtonTools: ToolsConfig = (tool) => ({
  moonDistance: tool({
    description: "The average distance between the centres of the Earth and the Moon.",
    parameters: z.object({}),
    handler: async () => ({ kilometres: 384_400, lightSeconds: 1.28 }),
  }),
});
```
<!-- end snippet -->

and hands it to `createAgentChat` with `tools: { newton: newtonTools }` (see [The backend](#the-backend)).
The form is the Agent block's own: a function that receives the `tool` factory and returns the
tools by name, each with a `description`, a Zod schema of its `parameters`, and a `handler`.
Tools for an agent that `defineAgents` does not define are refused when the backend starts.

Each call shows up on the phone as one of the answer's working steps, folded away under the
answer. Locally, the canned provider calls a tool whenever the question mentions its name, so
`Please use moonDistance` exercises the whole path without a model.

## The cost guard

An agent costs money per question, so it is fenced in:

- **Open sessions only.** Every method runs behind core's open-session guard. Before a session
  opens and after it closes, a question is refused before any model is called.
- **Turns per phone.** One device may take at most 20 turns in one conversation; the count is
  stored and raised before the model runs, so a phone retrying in a loop cannot spend more.
- **Message length.** At most 2000 characters per message, enforced on the server.
- **Conversation window.** The model sees a sliding window of the last 40 messages.
- **Auto-close.** A forgotten session closes on its own ([sessions-and-desk](../../slidesend-core/docs/sessions-and-desk.md#sessions)).

A cloned demo should not start spending because someone ran it. The example talk therefore
offers its chat only when started with `VITE_SLIDESEND_AGENT=1`. If a talk does the same, its
deck must read the switch in the browser **and** on the server: `slidesend deploy` hands every
`VITE_*` variable the site was built with to the backend, where the example reads it from
`process.env`.

## Models and cost

On AWS the tiers map to Bedrock's global cross-region inference profiles, with a fallback:

| Tier | Model | Fallback |
|---|---|---|
| `fast` | Claude Haiku 4.5 | Claude Sonnet 4.6 |
| `smart` | Claude Opus 4.8 | Claude Sonnet 4.6 |

Measured on the example talk (eu-central-1, `fast`, six questions from five phones): about
USD 0.0005 per question, 2.5 to 5 seconds per answer. Haiku 4.5 costs USD 1 per million input
tokens and USD 5 per million output tokens. A phone that uses all 20 turns with short questions
costs about USD 0.03; with every message at the length limit about USD 0.13. A class of 30
phones that all max out stays between USD 1 and USD 4. `smart` costs a multiple of that.

**Bedrock in an AWS Organization.** Global inference profiles route a request to whichever
region has capacity. A service control policy that denies regions outside an allow-list (for
example the AWS Control Tower region-deny control) therefore blocks every Claude call, even in
an allowed region. Exempt `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` from
that policy for the account the talk runs in. The error looks like any other access denial;
CloudTrail names the policy.

## Locally

`slidesend dev` on the AWS platform runs the backend on the AWS Blocks dev server. Without a
local model configured, the Agent block answers from its canned provider: the answer streams
token by token, history and resume work, and the guard refuses outside an open session. Only the
wording of the answers needs Bedrock.
