import { fileURLToPath } from "node:url";
import { slidesendDev } from "@nxsflow/slidesend-core/server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `VITE_SLIDESEND_PLATFORM=dev` runs the talk hosted on the dev bridge: core's server on the
// in-memory platform, with sessions and phones, but without a cloud account.
const hosted = process.env.VITE_SLIDESEND_PLATFORM === "dev";

export default defineConfig({
  resolve: {
    /**
     * `aws-blocks` is generated: `slidesend dev` and `vite build` write its client before Vite
     * starts. A run that does neither — local mode, or `slidesend check --render`, which starts
     * Vite itself — has no such file, and Vite answered every module with a 500 because the
     * import is in the graph even though nothing takes that branch. Outside AWS mode it
     * therefore resolves to a stub that is never executed.
     */
    ...(process.env.VITE_SLIDESEND_PLATFORM === "aws"
      ? {}
      : { alias: { "aws-blocks": fileURLToPath(new URL("./src/no-blocks.ts", import.meta.url)) } }),
  },
  plugins: [
    react(),
    ...(hosted
      ? [slidesendDev({ defaultPlannedMinutes: 20, secret: process.env.SLIDESEND_DEV_SECRET })]
      : []),
  ],
});
