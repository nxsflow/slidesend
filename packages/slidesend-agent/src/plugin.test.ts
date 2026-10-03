/**
 * A deck may only name an agent the talk actually defined. The alternative is finding out in the
 * room, when someone asks a question and nothing answers.
 */
import {
  defineDeck,
  definePlugin,
  definePresentation,
  defineSlide,
  stepMeta,
} from "@nxsflow/slidesend-core";
import { plainDesign } from "@nxsflow/slidesend-core/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { agentChat } from "./agent-chat";
import { defineAgents } from "./agents";
import { agent } from "./plugin";

const agents = defineAgents({
  newton: { systemPrompt: "You are Isaac Newton. Answer in two sentences." },
});

/** A slide that carries one activity, so a deck can be written in two lines. */
const asks = defineSlide({
  type: "asks",
  schema: z.object({ title: z.string(), ...stepMeta }),
  Component: () => null,
});

function talk(activity: unknown) {
  const deck = defineDeck({
    meta: { title: "With an agent", language: "en" },
    chapters: [{ id: "main", title: "Main" }],
    slides: [{ type: "asks", chapter: "main", id: "ask", title: "Ask", activity } as never],
  });
  return definePresentation({
    deck: deck as never,
    design: plainDesign,
    plugins: [agent({ agents }), definePlugin({ name: "test", slides: [asks] })],
  });
}

describe("the agent plugin", () => {
  it("accepts a chat with an agent the talk defined", () => {
    const presentation = talk(agentChat({ id: "ask-newton", agent: "newton" }));
    expect(presentation.steps[0]?.activity).toMatchObject({ agent: "newton" });
  });

  it("refuses an agent nobody defined, and names it", () => {
    expect(() => talk(agentChat({ id: "ask-nobody", agent: "einstein" } as never))).toThrow(
      /agent "einstein"/,
    );
  });

  it("refuses an agent name that could not be a block id", () => {
    expect(() => defineAgents({ "Not Valid": { systemPrompt: "x" } } as never)).toThrow(
      /lowercase letters/,
    );
    expect(() => defineAgents({ empty: { systemPrompt: "  " } })).toThrow(/no system prompt/);
  });
});
