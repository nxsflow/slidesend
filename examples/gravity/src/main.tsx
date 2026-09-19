import { httpPlatformClient, mount } from "@slidesend/core";
import presentation from "../presentation.config";

// Local mode by default; `VITE_SLIDESEND_PLATFORM=dev pnpm dev` uses the dev bridge instead.
const platform =
  import.meta.env.VITE_SLIDESEND_PLATFORM === "dev" ? httpPlatformClient() : undefined;

mount(presentation, { platform });
