/**
 * What an agent in a talk is (spec §10).
 *
 * The definition lives in ONE file that both halves import: the backend builds a block from it,
 * and the phone reads its name, its suggestions and — if the talk allows it — the system prompt
 * it runs under. A system prompt that the audience may read is a feature of a talk ABOUT agents,
 * which is what this package was extracted from; a talk that does not want it simply leaves the
 * flag off.
 *
 * It carries no AWS types, because the deck imports it in the browser too.
 */

/** How much model a talk wants to spend on an agent. The platform maps the tier to a model. */
export type ModelTier = "fast" | "smart";

/** One agent of a talk. */
export interface AgentDefinition {
  /**
   * What the agent is told before the first message. The talk owns this text; the tool never
   * adds to it, because an audience that is shown the prompt must see the whole of it.
   */
  systemPrompt: string;
  /** Which model tier to run on; the platform decides what that means. Defaults to `fast`. */
  model?: ModelTier;
  /** A name for the desk's tile and the phone's header; defaults to the key. */
  label?: string;
  /**
   * Whether the phone may show this agent's system prompt to the audience. Off unless the talk
   * says otherwise: a prompt can carry names, instructions and a tone nobody meant to publish.
   */
  showPrompt?: boolean;
}

/** The agents of a talk, by name. */
export type Agents<Names extends string = string> = Readonly<Record<Names, AgentDefinition>>;

/**
 * Declares the talk's agents. It only checks and returns them — the point is the TYPE: the keys
 * become the names a deck may reference, so `agentChat({ agent: "advisor" })` is a compile error
 * when no such agent exists, and a load-time error when the deck comes from somewhere else.
 */
export function defineAgents<const Names extends string>(agents: Agents<Names>): Agents<Names> {
  for (const [name, agent] of Object.entries(agents) as [string, AgentDefinition][]) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      throw new Error(
        `The agent name "${name}" must be lowercase letters, digits and dashes, starting with a letter: it becomes part of a block id.`,
      );
    }
    if (!agent.systemPrompt.trim()) {
      throw new Error(`The agent "${name}" has no system prompt.`);
    }
  }
  return agents;
}

/** The agent's name as the phone shows it. */
export function labelOf(agents: Agents, name: string): string {
  return agents[name]?.label ?? name;
}

/** The longest message a phone may send, in characters; the server refuses more. */
export const maxMessageChars = 2000;

/** How many turns one device may take in one conversation; a talk is not a chat product. */
export const maxTurns = 20;
