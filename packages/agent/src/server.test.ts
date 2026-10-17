import { isWireSafeError, Scope } from "@aws-blocks/blocks";
import { SessionClosedError } from "@slidesend/core";
import { createMemoryPlatform, type ServerMethod } from "@slidesend/core/server";
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

  it("sends the session guard's refusal to the client with its name, which AWS Blocks would hide", async () => {
    const agents = defineAgents({ newton: { systemPrompt: "You are Newton." } });
    const guards = {
      requireControl: async () => {},
      requireOpenSession: async () => {
        throw new SessionClosedError();
      },
    };
    const { api } = createAgentChat(new Scope("closed-test"), {
      agents,
      platform: createMemoryPlatform().server,
      guards,
    });
    const served = (api as (context: unknown) => Record<string, ServerMethod>)({});
    const refusal = await Promise.resolve(served.start?.("s", "a", "d", "newton")).catch(
      (e: unknown) => e,
    );
    expect(isWireSafeError(refusal)).toBe(true);
    expect(refusal).toMatchObject({
      name: "SessionClosedError",
      message: "The session is not open.",
    });
  });
});
