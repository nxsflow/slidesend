/**
 * Phone and desk name the agent as the talk named it, and offer its prompt only when the talk
 * allows the audience to read it: a button that answers nothing is worse than none.
 */
import {
  defineDeck,
  definePlugin,
  definePresentation,
  defineSlide,
  PresentationContext,
  stepMeta,
} from "@slidesend/core";
import { plainDesign } from "@slidesend/core/testing";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { agentChat, agentChatFor } from "./agent-chat";
import { defineAgents } from "./agents";
import { agent } from "./plugin";

const agents = defineAgents({
  newton: { label: "Isaac Newton", systemPrompt: "You are Isaac Newton.", showPrompt: true },
  quiet: { systemPrompt: "Nobody reads this." },
});

/** The smallest talk with the agent plugin, so the components can read their UI strings. */
const presentation = definePresentation({
  deck: defineDeck({
    meta: { title: "With an agent", language: "en" },
    chapters: [{ id: "main", title: "Main" }],
    slides: [{ type: "plain", chapter: "main", id: "one", title: "One" } as never],
  }) as never,
  design: plainDesign,
  plugins: [
    agent({ agents }),
    definePlugin({
      name: "test",
      slides: [
        defineSlide({
          type: "plain",
          schema: z.object({ title: z.string(), ...stepMeta }),
          Component: () => null,
        }),
      ],
    }),
  ],
});

const render = (element: ReactElement) =>
  renderToStaticMarkup(
    <PresentationContext.Provider value={presentation}>{element}</PresentationContext.Provider>,
  );

const data = (name: string) => ({ id: "ask", agent: name, singleTurn: false, suggestions: [] });

function phone(activity: ReturnType<typeof agentChatFor>, agent: string) {
  const { Participant } = activity;
  return render(<Participant data={data(agent) as never} />);
}

function desk(activity: ReturnType<typeof agentChatFor>, agent: string) {
  const { Monitor } = activity;
  if (!Monitor) throw new Error("agentChat has no Monitor");
  return render(<Monitor data={data(agent) as never} />);
}

describe("the agent chat", () => {
  it("shows the agent's label on the phone and on the desk", () => {
    const chat = agentChatFor(agents);
    expect(phone(chat, "newton")).toContain("Isaac Newton");
    expect(desk(chat, "newton")).toContain("Isaac Newton");
  });

  it("falls back to the agent's key when it has no label", () => {
    expect(phone(agentChatFor(agents), "quiet")).toContain(">quiet</h2>");
  });

  it("offers the prompt only when the talk allows it", () => {
    const chat = agentChatFor(agents);
    expect(phone(chat, "newton")).toContain("data-show-prompt");
    expect(phone(chat, "quiet")).not.toContain("data-show-prompt");
    // Without the talk's agents nothing says the prompt may be read.
    expect(phone(agentChat, "newton")).not.toContain("data-show-prompt");
  });
});
