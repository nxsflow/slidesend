import { httpPlatformClient, mount, type PlatformClient } from "@slidesend/core";
import presentation from "../presentation.config";

/**
 * Which platform the page talks to: `aws` on the AWS Blocks dev server or when deployed, `dev`
 * on the in-memory dev bridge, and none in local mode (plain `vite`).
 */
async function platform(): Promise<PlatformClient | undefined> {
  const mode = import.meta.env.VITE_SLIDESEND_PLATFORM;
  if (mode === "aws") {
    const [{ awsClient }, { slidesend }] = await Promise.all([
      import("@slidesend/aws"),
      import("aws-blocks"),
    ]);
    return awsClient({ slidesend });
  }
  return mode === "dev" ? httpPlatformClient() : undefined;
}

mount(presentation, { platform: await platform() });
