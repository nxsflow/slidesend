import { mount, type PlatformClient } from "@slidesend/core";
import presentation from "../presentation.config";

/**
 * On AWS — deployed, or on the AWS Blocks dev server of `npm run dev` — the page talks to the
 * backend in aws-blocks/index.ts. Everywhere else (`slidesend check --render`) it runs in local
 * mode, with stage and desk in one browser.
 */
async function platform(): Promise<PlatformClient | undefined> {
  if (import.meta.env.VITE_SLIDESEND_PLATFORM !== "aws") return undefined;
  const [{ awsClient }, blocks] = await Promise.all([
    import("@slidesend/aws"),
    import("aws-blocks"),
  ]);
  return awsClient(blocks as unknown as { slidesend: unknown });
}

mount(presentation, { platform: await platform() });
