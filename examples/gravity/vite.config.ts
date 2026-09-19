import { slidesendDev } from "@slidesend/core/server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `VITE_SLIDESEND_PLATFORM=dev` runs the talk hosted on the dev bridge: core's server on the
// in-memory platform, with sessions and phones, but without a cloud account.
const hosted = process.env.VITE_SLIDESEND_PLATFORM === "dev";

export default defineConfig({
  plugins: [
    react(),
    ...(hosted
      ? [slidesendDev({ defaultPlannedMinutes: 20, secret: process.env.SLIDESEND_DEV_SECRET })]
      : []),
  ],
});
