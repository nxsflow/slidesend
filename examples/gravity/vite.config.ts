import { slidesendDev } from "@slidesend/core/server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    // Serves core's server on the in-memory platform during `pnpm dev`, for sessions and phones
    // without a cloud account. The page uses it when VITE_SLIDESEND_PLATFORM=dev.
    slidesendDev({ defaultPlannedMinutes: 20, secret: process.env.SLIDESEND_DEV_SECRET }),
  ],
});
