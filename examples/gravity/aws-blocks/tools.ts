import type { ToolsConfig } from "@aws-blocks/blocks";
import { z } from "zod";

/**
 * Newton's one tool: how far away the Moon is. It lives in the backend, not in `src/agents.ts`,
 * because a tool's handler is server code and `agents.ts` is loaded by the phones too.
 */
// snippet: agent-tools
export const newtonTools: ToolsConfig = (tool) => ({
  moonDistance: tool({
    description: "The average distance between the centres of the Earth and the Moon.",
    parameters: z.object({}),
    handler: async () => ({ kilometres: 384_400, lightSeconds: 1.28 }),
  }),
});
// end snippet
