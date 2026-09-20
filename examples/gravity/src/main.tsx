import { httpPlatformClient, mount, type PlatformClient, type Presentation } from "@slidesend/core";
import defaultPresentation from "../presentation.config";

/**
 * Which deck to mount: the talk's own, unless `slidesend` is checking another one.
 *
 * `slidesend check --render` renders the app, so a check of a different config has to reach the
 * app as well — that is how this example proves that the render pass catches a slide that does
 * not fit (`fixtures/overfull`).
 */
// Lazily, one at a time: a fixture that is deliberately invalid must not be loaded by a run
// that did not ask for it.
const configs = import.meta.glob("../fixtures/*/presentation.config.ts") as Record<
  string,
  () => Promise<{ default: Presentation }>
>;
const asked = import.meta.env.VITE_SLIDESEND_CONFIG?.replace(/^\.?\//, "");
// Matched exactly, not by suffix: every fixture's file is called `presentation.config.ts`, so
// a suffix match would hand the talk's own run the first fixture it found.
const load = asked
  ? Object.entries(configs).find(([path]) => path.replace(/^\.\.\//, "") === asked)?.[1]
  : undefined;
const presentation = load ? (await load()).default : defaultPresentation;

/**
 * Which platform the page talks to: `aws` on the AWS Blocks dev server or when deployed, `dev`
 * on the in-memory dev bridge, and none in local mode (plain `vite`).
 */
async function platform(): Promise<PlatformClient | undefined> {
  const mode = import.meta.env.VITE_SLIDESEND_PLATFORM;
  if (mode === "aws") {
    const [{ awsClient }, blocks] = await Promise.all([
      import("@slidesend/aws"),
      import("aws-blocks"),
    ]);
    // Every API namespace the backend exports is handed over: core's `slidesend` and, when the
    // talk runs its agent, the chat's own namespace (spec §4.1).
    return awsClient(blocks as unknown as { slidesend: unknown });
  }
  return mode === "dev" ? httpPlatformClient() : undefined;
}

mount(presentation, { platform: await platform() });
