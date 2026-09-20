import { defineAgents } from "@slidesend/agent";

/**
 * The talk's agents, in one file both halves import (spec §10): the backend builds a block from
 * this, and the deck's `agentChat` references it by name.
 *
 * The chat is OFF unless the talk is started with `SLIDESEND_AGENT=1`. An agent costs money per
 * question, and a demo that a stranger clones should not start spending because they ran it.
 */
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

/**
 * Whether this run of the talk offers the chat at all: `VITE_SLIDESEND_AGENT=1`.
 *
 * It is a Vite variable rather than `process.env`, because the deck is loaded in the browser as
 * well as in Node, and `process` does not exist there.
 */
export const agentEnabled = import.meta.env?.VITE_SLIDESEND_AGENT === "1";
