import { httpPlatformClient, mount, type PlatformClient } from "@slidesend/core";
import presentation from "../presentation.config";

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
