import { Scope } from "@aws-blocks/blocks";
import { createMemoryPlatform } from "@nxsflow/slidesend-core/server";
import { describe, expect, it } from "vitest";
import { defineAgents } from "./agents";
import { createAgentChat } from "./server";

describe("createAgentChat", () => {
  it("refuses tools for an agent the talk does not define", () => {
    const agents = defineAgents({ newton: { systemPrompt: "You are Newton." } });
    const guards = { requireControl: async () => {}, requireOpenSession: async () => {} };
    expect(() =>
      createAgentChat(new Scope("tools-test"), {
        agents,
        platform: createMemoryPlatform().server,
        guards,
        tools: { einstein: () => ({}) },
      }),
    ).toThrow('Tools are given for the agent "einstein", but no such agent is defined.');
  });
});
