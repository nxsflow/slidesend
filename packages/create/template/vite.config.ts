import { slidesendDev } from "@slidesend/core/server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run dev` starts Vite in the mode "bridge": Slidesend's server then runs in memory inside
// the dev server, so phones on your network can join. Any other mode is local mode: stage and
// desk in one browser, no audience — that is what `slidesend check --render` uses.
// snippet: vite
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "bridge" ? [slidesendDev({ defaultPlannedMinutes: 18 })] : [])],
}));
// end snippet
