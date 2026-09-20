import { lockCheck } from "@slidesend/core/checks";
import { hostedPort, hostedSecret } from "../playwright.config";

const base = `http://localhost:${hostedPort}`;

/** This talk's own way to reach its dev bridge; the check itself knows nothing about it. */
const call = async (method: string, args: unknown[]) => {
  const response = await fetch(`${base}/__slidesend/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, args }),
  });
  const body = (await response.json()) as {
    ok: boolean;
    result?: unknown;
    error?: { message: string };
  };
  if (!body.ok) throw new Error(body.error?.message ?? "call failed");
  return body.result;
};

// The check comes from the tool (spec §16); only the way into this talk's backend is local.
lockCheck({
  baseUrl: base,
  async open() {
    // A rehearsal, so repeated and parallel runs never meet the one-open-live-session rule.
    const session = (await call("sessionCreate", [
      hostedSecret,
      { kind: "rehearsal", name: `Lock ${Date.now()}` },
    ])) as { id: string };
    await call("sessionOpen", [hostedSecret, session.id]);
    return {
      id: session.id,
      stagePath: `/stage/${session.id}#key=${hostedSecret}`,
      followerPath: `/stage/${session.id}`,
    };
  },
  close: (id) => call("sessionClose", [hostedSecret, id]) as Promise<void>,
  // An open event stream survives the browser's offline switch; cut it as the network would.
  drop: async () => {
    await fetch(`${base}/__slidesend/drop`, { method: "POST" });
  },
});
