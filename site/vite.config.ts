import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Served under nxsflow.com/slidesend: the landing distribution routes /slidesend* here. */
export default defineConfig({
  base: "/slidesend/",
  plugins: [react()],
});
