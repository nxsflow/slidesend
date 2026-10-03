import { httpPlatformClient, mount } from "@nxsflow/slidesend-core";
import presentation from "../presentation.config";

// snippet: main
// In the mode "bridge" (`npm run dev`) the page talks to the dev bridge; otherwise local mode.
const bridge = import.meta.env.MODE === "bridge";
mount(presentation, { platform: bridge ? httpPlatformClient() : undefined });
// end snippet
